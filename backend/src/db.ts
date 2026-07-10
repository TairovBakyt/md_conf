import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Создаем пул подключений к базе данных
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

// Проверка подключения при старте
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err);
  } else {
    console.log('🚀 База данных успешно подключена!');
  }
});