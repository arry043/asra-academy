import cors from 'cors';
import express, { type Express } from 'express';
import helmet from 'helmet';
import { API_PREFIX } from './config/constants.js';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error-handler.js';
import { notFoundHandler } from './middleware/not-found.js';
import { requestLogger } from './middleware/request-logger.js';
import { apiRouter } from './routes/index.js';

/** Builds the Express application without binding a port (keeps it testable). */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  // Behind a reverse proxy / load balancer in hosted environments.
  app.set('trust proxy', env.isProduction ? 1 : false);

  app.use(requestLogger);
  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      exposedHeaders: ['X-Request-Id'],
    }),
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
