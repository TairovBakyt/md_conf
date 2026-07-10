-- ==========================================
-- MDCONF 2026 — схема базы данных
-- ==========================================
 
CREATE TABLE users (
    id VARCHAR(255) PRIMARY KEY,
    username VARCHAR(255) NOT NULL,
    total_score INT DEFAULT 0,
    is_admin BOOLEAN DEFAULT FALSE,
    pin_code VARCHAR(4)
);
 
CREATE TABLE quiz_sessions (
    user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_question_index INT DEFAULT 0,
    current_quiz_score INT DEFAULT 0,
    question_start_time TIMESTAMP
);
 
CREATE TABLE achievements (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  points INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);
 
CREATE TABLE filword_sessions (
  user_id VARCHAR(255) PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  found_words TEXT[] DEFAULT '{}',
  start_time TIMESTAMP,
  score INT DEFAULT 0,
  is_finished BOOLEAN DEFAULT FALSE
);
 
CREATE TABLE prizes (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  tier VARCHAR(20) NOT NULL,
  cost INT NOT NULL,
  stock INT DEFAULT NULL,
  description TEXT
);
 
CREATE TABLE prize_redemptions (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
  prize_id INT REFERENCES prizes(id),
  redeemed_at TIMESTAMP DEFAULT NOW()
);
 
CREATE TABLE event_settings (
  id INT PRIMARY KEY DEFAULT 1,
  quiz_unlocked BOOLEAN DEFAULT FALSE,
  filword_unlocked BOOLEAN DEFAULT FALSE,
  CONSTRAINT single_row CHECK (id = 1)
);
 
-- ==========================================
-- Начальные данные
-- ==========================================
 
-- Первый администратор (чтобы было кем войти и назначить остальных через /admin)
INSERT INTO users (id, username, total_score, is_admin, pin_code)
VALUES ('admin_Bakyt', 'Bakyt_Admin', 0, TRUE, '0000');
 
-- Обязательная строка настроек — без неё /api/settings будет отдавать пустой результат
INSERT INTO event_settings (id, quiz_unlocked, filword_unlocked) VALUES (1, FALSE, FALSE);
 
-- Каталог призов
INSERT INTO prizes (title, tier, cost, stock) VALUES
('Стикерпак MDCONF', 'low', 10, NULL),
('Картхолдер', 'low', 20, 50),
('Бутылка MDCONF', 'middle', 40, 30),
('Шоппер', 'middle', 60, 30),
('Футболка MDCONF', 'high', 80, 20),
('Подписка на ИТ-сервис (на выбор)', 'high', 90, 15),
('Билет на закрытый Afterparty', 'high', 100, 10);