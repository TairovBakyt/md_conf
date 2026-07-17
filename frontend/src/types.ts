// Описываем пользователя
export interface User {
  id: string;            // Уникальный ID (генерируется при регистрации)
  username: string;      // Имя или никнейм участника
  total_score: number;    // Текущий баланс баллов в магазине
  achievements?: Achievement[]; // Список того, что он уже прошел
  is_quiz_passed:boolean;
  is_filword_passed: boolean;
  is_admin:boolean;
  session_version?: number;
}

// Описываем достижение (историю баллов)
export interface Achievement {
  id: string;
  title: string;        // Например: "Викторина Hardcore QA" или "Подписка на LinkedIn"
  points: number;       // Сколько баллов получено (например: 15)
  createdAt: string;    // Дата и время получения
}

// Описываем вопрос викторины для ФРОНТЕНДА (без правильного ответа!)
export interface QuizQuestion {
  id: number;
  questionText: string;
  options: string[];    // Массив из 4 вариантов ответов
}