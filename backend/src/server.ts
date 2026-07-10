import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import userRoutes from './routes/user.routes';
import settingsRoutes from './routes/settings.routes';
import quizRoutes from './routes/quiz.routes';
import filwordRoutes from './routes/filword.routes';
import prizesRoutes from './routes/prizes.routes';
import adminRoutes from './routes/admin.routes';

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/filword', filwordRoutes);
app.use('/api/prizes', prizesRoutes);
app.use('/api/admin', adminRoutes);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🔥 Сервер развернут на http://localhost:${PORT}`);
});