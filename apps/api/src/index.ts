import 'dotenv/config';
import express, { ErrorRequestHandler } from 'express';
import pinoHttp from 'pino-http';
import helmet from 'helmet';
import cors from 'cors';
import { randomUUID } from 'crypto';
import apiRouter from './routes/index.js';
import adminRouter from './routes/admin.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
// Disable ETag/304 to avoid client caching issues for API JSON (React Query + Nginx)
app.set('etag', false);
app.use(helmet());
app.use(cors({ origin: process.env.WEB_ORIGIN }));
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

app.use((req, res, next) => {
  // @ts-ignore
  req.id = randomUUID();
  next();
});

app.use(pinoHttp({
  // @ts-ignore
  customProps: (req) => ({
    // @ts-ignore
    requestId: req.id,
  }),
  redact: ['req.headers.authorization'],
}));

// Routes
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use('/api', apiRouter);
app.use('/admin', adminRouter);

// Centralized Error Handler
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // @ts-ignore
  req.log.error(err);
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.',
    },
  });
};

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API server listening at http://localhost:${port}`);
});
