import express from 'express';
import { sessionMiddleware } from './middleware/session.js';
import uploadRouter from './routes/upload.js';
import sessionRouter from './routes/session.js';
import filesRouter from './routes/files.js';
import samplesRouter from './routes/samples.js';

const app = express();

app.use(express.json());
app.use(sessionMiddleware);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/upload', uploadRouter);
app.use('/api/session', sessionRouter);
app.use('/api/files', filesRouter);
app.use('/api/samples', samplesRouter);

export default app;
