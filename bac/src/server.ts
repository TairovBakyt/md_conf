
import express, { Request, Response } from 'express';
import cors from 'cors';
import { pool } from './db';
import questions from './questions.json';
import filwordData from './filword.json';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const FILWORD_TIME_LIMIT = 90; // 1.5 минуты в секундах
const POINTS_PER_WORD = 2;

// Помощник: завершить игру и начислить баллы в основной профиль (только один раз)
async function finalizeFilword(userId: string, score: number) {
  await pool.query('UPDATE filword_sessions SET is_finished = true WHERE user_id = $1', [userId]);
  await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [score, userId]);
}

// ==========================================
// 1. ЭНДПОИНТ АВТОРИЗАЦИИ / РЕГИСТРАЦИИ
// ==========================================
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, pin } = req.body;

  if (!username || username.trim() === '') {
    return res.status(400).json({ error: 'Имя пользователя обязательно' });
  }

  if (!pin || pin.length !== 4) {
    return res.status(400).json({ error: 'PIN-код должен состоять из 4 цифр' });
  }

  try {
    // Проверяем, есть ли уже такой юзер в базе
    const userCheck = await pool.query('SELECT * FROM users WHERE username = $1', [username]);

    if (userCheck.rows.length > 0) {
       // Юзер уже есть — сверяем PIN
      const existingUser = userCheck.rows[0];

      if (existingUser.pin_code !== pin) {
        return res.status(401).json({ error: 'Неверный PIN-код' });
      }

      return res.json(existingUser);
    } else {
      // Если нет, регистрируем нового участника
      // Генерируем простой ID вида user_123456789
      const newId = `user_${Math.floor(Math.random() * 100000000)}`;
      
      const newUser = await pool.query(
        'INSERT INTO users (id, username, total_score,pin_code) VALUES ($1, $2, $3, $4) RETURNING *',
        [newId, username, 0,pin]
      );
      
      return res.status(201).json(newUser.rows[0]);
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка сервера при авторизации' });
  }
});

// ==========================================
// 2. ЭНДПОИНТ ДАШБОРДА (ПОЛУЧИТЬ ДАННЫЕ ЮЗЕРА)
// ==========================================
app.get('/api/user/:id', async (req: Request, res: Response) => {
  const userId = req.params.id;

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    const user = userResult.rows[0];

    // Проверяем, пройдена ли уже викторина этим пользователем
    const sessionCheck = await pool.query('SELECT current_question_index FROM quiz_sessions WHERE user_id = $1', [userId]);
    
    // Если в сессиях индекс равен длине массива вопросов, значит викторина окончена
    const isQuizPassed = sessionCheck.rows.length > 0 && sessionCheck.rows[0].current_question_index >= questions.length;
    const filwordSessionCheck = await pool.query('SELECT is_finished FROM filword_sessions WHERE user_id = $1', [userId]);
    const isFilwordPassed = filwordSessionCheck.rows.length > 0 && filwordSessionCheck.rows[0].is_finished;

    const achievementsResult = await pool.query('SELECT * FROM achievements WHERE user_id = $1', [userId]);

    const redeemedPrizesResult = await pool.query(`
      SELECT pr.id, pr.redeemed_at, p.title, p.cost
      FROM prize_redemptions pr
      JOIN prizes p ON pr.prize_id = p.id
      WHERE pr.user_id = $1
      ORDER BY pr.redeemed_at DESC
    `, [userId]);

    return res.json({
      id: user.id,
      username: user.username,
      total_score: user.total_score,
      is_quiz_passed: isQuizPassed,
      is_filword_passed: isFilwordPassed,
      is_admin: user.is_admin,   // ДОБАВЛЕНО
      achievements: achievementsResult.rows,
      redeemed_prizes: redeemedPrizesResult.rows, 
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения данных дашборда' });
  }
});


// ==========================================
// НАСТРОЙКИ МЕРОПРИЯТИЯ (ПООЧЕРЁДНОЕ ОТКРЫТИЕ ИГР)
// ==========================================

app.get('/api/settings', async (req: Request, res: Response) => {
  try {
    const result = await pool.query('SELECT quiz_unlocked, filword_unlocked FROM event_settings WHERE id = 1');
    const row = result.rows[0] || { quiz_unlocked: false, filword_unlocked: false };
    return res.json(row);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения настроек' });
  }
});

app.post('/api/admin/toggle-game', async (req: Request, res: Response) => {
  const { adminId, game, unlocked } = req.body;

  if (game !== 'quiz' && game !== 'filword') {
    return res.status(400).json({ error: 'Неизвестная игра' });
  }

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    const column = game === 'quiz' ? 'quiz_unlocked' : 'filword_unlocked';
    await pool.query(`UPDATE event_settings SET ${column} = $1 WHERE id = 1`, [unlocked]);

    return res.json({ success: true, game, unlocked });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка изменения настроек' });
  }
});


// ==========================================
// 3. ЛОГИКА ИГРЫ-ВИКТОРИНЫ
// ==========================================

// А. НАЧАТЬ ИГРУ
app.post('/api/quiz/start', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'ID пользователя обязателен' });

  try {
    const settingsCheck = await pool.query('SELECT quiz_unlocked FROM event_settings WHERE id = 1');
    if (!settingsCheck.rows[0]?.quiz_unlocked) {
      return res.status(403).json({ error: 'Викторина ещё не открыта организатором' });
    }
    // Проверяем, запускал ли юзер игру раньше
    const sessionCheck = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length > 0) {
      // Если игра уже пройдена до конца, не даем начать заново
      if (sessionCheck.rows[0].current_question_index >= questions.length) {
        return res.status(400).json({ error: 'Вы уже прошли эту викторину!' });
      }
      // Если игра была прервана, просто возвращаем текущее состояние
      return res.json({ message: 'Продолжаем игру', currentIndex: sessionCheck.rows[0].current_question_index });
    }

    // Если это первый запуск — создаем пустую сессию в базе
    await pool.query(
      'INSERT INTO quiz_sessions (user_id, current_question_index, current_quiz_score, question_start_time) VALUES ($1, $2, $3, $4)',
      [userId, 0, 0, new Date()]
    );

    return res.status(201).json({ message: 'Игра началась', currentIndex: 0 });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка при старте игры' });
  }
});

// Б. ПОЛУЧИТЬ ТЕКУЩИЙ ВОПРОС
app.get('/api/quiz/question/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const sessionResult = await pool.query('SELECT current_question_index FROM quiz_sessions WHERE user_id = $1', [userId]);
    
    if (sessionResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия игры не найдена. Сначала начните игру.' });
    }

    const currentIndex = sessionResult.rows[0].current_question_index;

    // Если вопросы кончились
    if (currentIndex >= questions.length) {
      return res.json({ isFinished: true });
    }

    // Берем вопрос из нашего JSON-файла
    const fullQuestion = questions[currentIndex];

    // Фишка безопасности: вырезаем правильный ответ ("correct"), чтобы фронтенд его не знал!
    const safeQuestion = {
      id: fullQuestion.id,
      questionText: fullQuestion.question,
      options: fullQuestion.options,
      currentIndex: currentIndex,
      totalQuestions: questions.length
    };

    // Засекаем время выдачи вопроса на сервере и обновляем в БД
    await pool.query('UPDATE quiz_sessions SET question_start_time = $1 WHERE user_id = $2', [new Date(), userId]);

    return res.json(safeQuestion);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения вопроса' });
  }
});

// В.ОТПРАВИТЬ ОТВЕТ И ПРОВЕРИТЬ ТАЙМЕР
app.post('/api/quiz/answer', async (req: Request, res: Response) => {
  const { userId, selectedOption } = req.body; // selectedOption - индекс ответа (0, 1, 2, 3). Если время вышло, фронт шлет null

  try {
    // Получаем текущую сессию игрока
    const sessionResult = await pool.query('SELECT * FROM quiz_sessions WHERE user_id = $1', [userId]);
    if (sessionResult.rows.length === 0) return res.status(404).json({ error: 'Сессия не найдена' });

    const session = sessionResult.rows[0];
    const currentIndex = session.current_question_index;

    if (currentIndex >= questions.length) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    // --- ПРОВЕРКА ТАЙМЕРА ПО ЧАСАМ СЕРВЕРА ---
    const now = new Date().getTime();
    const startTime = new Date(session.question_start_time).getTime();
    const secondsPassed = (now - startTime) / 1000;

    let pointsToAdd = 0;
    let isTimeOut = false;

    // Даем запас в 1.5-2 секунды на пинг и задержку сети (22 секунды суммарно)
    if (secondsPassed > 22) {
      isTimeOut = true; // Время вышло, ответ аннулируется
    }
    // Если в тайминг уложился и ответ пришел (не null)
    if (!isTimeOut && selectedOption !== null) {
      const correctAnswerIndex = questions[currentIndex].correct;
      if (Number(selectedOption) === correctAnswerIndex) {
        pointsToAdd = 1; // Ответ верный!
      }
    }

    // Вычисляем новый индекс вопроса
    const nextIndex = currentIndex + 1;
    let finalQuizScore = session.current_quiz_score + pointsToAdd;

    // Обновляем сессию в БД (переводим на следующий вопрос)
    await pool.query(
      'UPDATE quiz_sessions SET current_question_index = $1, current_quiz_score = $2 WHERE user_id = $3',
      [nextIndex, finalQuizScore, userId]
    );

    // ЕСЛИ ЭТО БЫЛ ПОСЛЕДНИЙ ВОПРОС — НАЧИСЛЯЕМ БАЛЛЫ В ОСНОВНОЙ ПРОФИЛЬ
    if (nextIndex >= questions.length) {
      
      // Считаем бонусы по ТЗ: за 20 из 20 накидываем сверху 5 экстра-баллов
      let bonusPoints = 0;
      if (finalQuizScore === questions.length) {
        bonusPoints = 5;
      }
      
      const totalEarned = finalQuizScore + bonusPoints;

      // Записываем финальные баллы в таблицу users
      await pool.query('UPDATE users SET total_score = total_score + $1 WHERE id = $2', [totalEarned, userId]);

      if (bonusPoints > 0) {
        await pool.query(
          'INSERT INTO achievements (user_id, title, points) VALUES ($1, $2, $3)',
          [userId, 'Senior Developer', bonusPoints]
        );
      }

      return res.json({
        isFinished: true,
        scoreEarned: finalQuizScore,
        bonusEarned: bonusPoints,
        totalEarned: totalEarned,
        wasCorrect: pointsToAdd > 0,
        message: bonusPoints > 0 ? 'Senior Developer! +5 экстра-баллов!' : 'Игра окончена'
      });
    }

    // Если игра продолжается, просто говорим фронтенду переходить к следующему шагу
    return res.json({
      isFinished: false,
      isTimeOut: isTimeOut,
      wasCorrect: pointsToAdd > 0
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки ответа' });
  }
});

// ==========================================
// 4. ЛОГИКА ИГРЫ-ФИЛВОРДА (WORD RESEARCHER)
// ==========================================

// А. НАЧАТЬ ИГРУ
app.post('/api/filword/start', async (req: Request, res: Response) => {
  const { userId } = req.body;

  if (!userId) return res.status(400).json({ error: 'ID пользователя обязателен' });

  try {
    const settingsCheck = await pool.query('SELECT filword_unlocked FROM event_settings WHERE id = 1');
    if (!settingsCheck.rows[0]?.filword_unlocked) {
      return res.status(403).json({ error: 'Филворд ещё не открыт организатором' });
    }
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length > 0) {
      const session = sessionCheck.rows[0];

      if (session.is_finished) {
        return res.status(400).json({ error: 'Вы уже прошли эту игру!' });
      }

      const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

      if (secondsPassed > FILWORD_TIME_LIMIT) {
        await finalizeFilword(userId, session.score);
        return res.status(400).json({ error: 'Время вышло, игра завершена' });
      }

      return res.json({
        message: 'Продолжаем игру',
        foundWords: session.found_words,
        secondsLeft: Math.max(0, FILWORD_TIME_LIMIT - secondsPassed)
      });
    }

    await pool.query(
      'INSERT INTO filword_sessions (user_id, found_words, start_time, score, is_finished) VALUES ($1, $2, $3, $4, $5)',
      [userId, [], new Date(), 0, false]
    );

    return res.status(201).json({ message: 'Игра началась', secondsLeft: FILWORD_TIME_LIMIT });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка при старте игры' });
  }
});

// Б. ПОЛУЧИТЬ ДОСКУ (СЕТКУ И СПИСОК СЛОВ)
app.get('/api/filword/board/:userId', async (req: Request, res: Response) => {
  const { userId } = req.params;

  try {
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия игры не найдена. Сначала начните игру.' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.json({ isFinished: true });
    }

    const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      await finalizeFilword(userId as string, session.score);
      return res.json({ isFinished: true });
    }

    return res.json({
      grid: filwordData.grid,
      words: filwordData.words,
      foundWords: session.found_words,
      secondsLeft: Math.max(0, FILWORD_TIME_LIMIT - secondsPassed)
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения доски' });
  }
});

// В. ОТПРАВИТЬ НАЙДЕННОЕ СЛОВО
app.post('/api/filword/submit', async (req: Request, res: Response) => {
  const { userId, word } = req.body;

  try {
    const sessionCheck = await pool.query('SELECT * FROM filword_sessions WHERE user_id = $1', [userId]);

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сессия не найдена' });
    }

    const session = sessionCheck.rows[0];

    if (session.is_finished) {
      return res.status(400).json({ error: 'Игра уже завершена' });
    }

    const secondsPassed = (new Date().getTime() - new Date(session.start_time).getTime()) / 1000;

    if (secondsPassed > FILWORD_TIME_LIMIT) {
      await finalizeFilword(userId, session.score);
      return res.json({ isFinished: true, isTimeOut: true, totalEarned: session.score });
    }

    const normalizedWord = String(word || '').toUpperCase().trim();
    const alreadyFound = session.found_words.includes(normalizedWord);
    const isRealWord = filwordData.words.includes(normalizedWord);

    if (!isRealWord || alreadyFound) {
      return res.json({
        isValid: false,
        isFinished: false,
        foundWords: session.found_words,
        scoreSoFar: session.score
      });
    }

    const newFoundWords = [...session.found_words, normalizedWord];
    const newScore = session.score + POINTS_PER_WORD;
    const isAllFound = newFoundWords.length >= filwordData.words.length;

    await pool.query(
      'UPDATE filword_sessions SET found_words = $1, score = $2 WHERE user_id = $3',
      [newFoundWords, newScore, userId]
    );

    if (isAllFound) {
      await finalizeFilword(userId, newScore);
      return res.json({
        isValid: true,
        isFinished: true,
        foundWords: newFoundWords,
        scoreSoFar: newScore,
        totalEarned: newScore,
        message: 'Все слова найдены!'
      });
    }

    return res.json({
      isValid: true,
      isFinished: false,
      foundWords: newFoundWords,
      scoreSoFar: newScore
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обработки слова' });
  }
});


// ==========================================
// 5. МАГАЗИН ПРИЗОВ
// ==========================================

// А. ПОЛУЧИТЬ СПИСОК ВСЕХ ПРИЗОВ
app.get('/api/prizes', async (req: Request, res: Response) => {
  try {
    const prizesResult = await pool.query('SELECT * FROM prizes ORDER BY cost ASC');
    return res.json(prizesResult.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка призов' });
  }
});

// Б. ОБМЕНЯТЬ БАЛЛЫ НА ПРИЗ
app.post('/api/prizes/redeem', async (req: Request, res: Response) => {
  const { userId, prizeId } = req.body;

  if (!userId || !prizeId) {
    return res.status(400).json({ error: 'userId и prizeId обязательны' });
  }

  try {
    const userResult = await pool.query('SELECT * FROM users WHERE id = $1', [userId]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    const user = userResult.rows[0];

    const prizeResult = await pool.query('SELECT * FROM prizes WHERE id = $1', [prizeId]);
    if (prizeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Приз не найден' });
    }
    const prize = prizeResult.rows[0];

    if (user.total_score < prize.cost) {
      return res.status(400).json({ error: 'Недостаточно баллов' });
    }

    if (prize.stock !== null) {
      const redeemedCountResult = await pool.query(
        'SELECT COUNT(*) FROM prize_redemptions WHERE prize_id = $1',
        [prizeId]
      );
      const redeemedCount = parseInt(redeemedCountResult.rows[0].count, 10);

      if (redeemedCount >= prize.stock) {
        return res.status(400).json({ error: 'Приз закончился' });
      }
    }

    await pool.query('UPDATE users SET total_score = total_score - $1 WHERE id = $2', [prize.cost, userId]);
    await pool.query('INSERT INTO prize_redemptions (user_id, prize_id) VALUES ($1, $2)', [userId, prizeId]);

    return res.json({ success: true, prizeTitle: prize.title, newBalance: user.total_score - prize.cost });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка обмена приза' });
  }
});

// В. АДМИН — СПИСОК ВСЕХ ВЫКУПЛЕННЫХ ПРИЗОВ (ДЛЯ ВЫДАЧИ)
app.get('/api/admin/redemptions', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.redeemed_at, u.username, u.id AS user_id, p.title AS prize_title, p.cost
      FROM prize_redemptions pr
      JOIN users u ON pr.user_id = u.id
      JOIN prizes p ON pr.prize_id = p.id
      ORDER BY pr.redeemed_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка выдач' });
  }
});

// Г. АДМИН — СПИСОК ВСЕХ ДОСТИЖЕНИЙ УЧАСТНИКОВ
app.get('/api/admin/achievements', async (req: Request, res: Response) => {
  try {
    const result = await pool.query(`
      SELECT a.id, a.title, a.points, a.created_at, u.username, u.id AS user_id
      FROM achievements a
      JOIN users u ON a.user_id = u.id
      ORDER BY a.created_at DESC
    `);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка получения списка достижений' });
  }
});


// ==========================================
// 4. АДМИН — НАЧИСЛЕНИЕ БАЛЛОВ ЗА СТАНЦИЮ
// ==========================================
app.post('/api/admin/scan', async (req: Request, res: Response) => {
  const { adminId, targetUserId, points } = req.body;

  try {
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [adminId]);

    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: 'Доступ запрещён' });
    }

    await pool.query(
      'UPDATE users SET total_score = total_score + $1 WHERE id = $2',
      [points, targetUserId]
    );

    return res.json({ success: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Ошибка начисления баллов' });
  }
});



// Запуск сервера
app.listen(PORT, () => {
  console.log(`🔥 Сервер развернут на http://localhost:${PORT}`);
});
