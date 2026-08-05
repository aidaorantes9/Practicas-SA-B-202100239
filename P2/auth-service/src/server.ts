import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { connectDatabase, sequelize } from './config/database';
import authRoutes from './routes/auth.routes';
import protectedRoutes from './routes/protected.routes';    

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true, // necesario para que el navegador envíe/reciba cookies
    exposedHeaders: ['X-Token-Renewed'], // sin esto, el navegador oculta este header al JS del frontend
  })
);
app.use(express.json());
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'auth-service' });
});

app.use('/api/auth', authRoutes);
app.use('/api', protectedRoutes);

async function start() {
  await connectDatabase();
  await sequelize.sync();
  console.log('Modelos sincronizados con la base de datos.');

  app.listen(PORT, () => {
    console.log(`auth-service escuchando en el puerto ${PORT}`);
  });
}

start();