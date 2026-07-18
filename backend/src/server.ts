import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import settingsRoutes from './routes/settings.routes';
import quizRoutes from './routes/quiz.routes';
import filwordRoutes from './routes/filword.routes';
import prizesRoutes from './routes/prizes.routes';
import adminRoutes from './routes/admin.routes';
import chatRoutes from './routes/chat.routes';
import objectsRoutes from './routes/objects.routes';
import stationsRoutes from './routes/stations.routes';
import adminChatRoutes from './routes/admin-chat.routes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
// Лимит увеличен до 15mb — фото/видео/аудио с телефона в base64 (JSON body)
// не помещались в дефолтный лимит express.json() в 100kb, из-за чего
// отправка вложений с мобильных устройств зависала на "Загружаем..."
app.use(express.json({ limit: '15mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/filword', filwordRoutes);
app.use('/api/prizes', prizesRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/objects', objectsRoutes);
app.use('/api/stations', stationsRoutes);
app.use('/api/admin-chat', adminChatRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Сервер развернут на http://localhost:${PORT}`);
});