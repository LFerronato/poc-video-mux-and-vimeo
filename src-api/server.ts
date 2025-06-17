import express from 'express';
import videosRouter from './api/videos';
import { errorHandler } from './middleware/errorHandler';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

app.use('/videos', videosRouter);

app.get('/', (req, res) => {
  res.json({ message: 'API de upload de vídeo' });
});

// Error handling middleware deve ser o último
app.use(errorHandler);

const PORT = process.env.PORT || 3333;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
}); 