import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authorizationRoutes from './routes/authorization.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4001;

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok', service: 'authz-service' });
});

app.use('/', authorizationRoutes);

app.listen(PORT, () => {
  console.log(`authz-service escuchando en el puerto ${PORT}`);
});