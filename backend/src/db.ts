import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Создаем пул подключений к базе данных
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Neon pooled endpoint (pgbouncer) расcчитан на много соединений — 10 по умолчанию узко при параллельной работе участников
  idleTimeoutMillis: 30000, // закрывать неиспользуемые соединения через 30с, не держать их вхолостую
  connectionTimeoutMillis: 5000, // не ждать соединение бесконечно — быстрый явный сбой вместо зависшего запроса
});

// Логируем неожиданные обрывы соединений в пуле, чтобы не терять их молча
pool.on('error', (err) => {
  console.error('❌ Неожиданная ошибка пула соединений:', err);
});

// Проверка подключения при старте
pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Ошибка подключения к базе данных:', err);
  } else {
    console.log('🚀 База данных успешно подключена!');
  }
});