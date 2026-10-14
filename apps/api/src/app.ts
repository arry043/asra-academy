import type { IncomingMessage, ServerResponse } from 'node:http';
import cookieParser from 'cookie-parser';
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
  // JSON-only API: Helmet's defaults (nosniff, HSTS, frameguard, a deny-all CSP, CORP …) are
  // appropriate as-is — the API serves no HTML, scripts or styles.
  app.use(helmet());
  app.use(
    cors({
      // Explicit allow-list (never `*`): required because credentials (the refresh cookie) are
      // allowed. Unknown origins get no CORS headers, so browsers block their reads.
      origin: env.corsOrigins,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id', 'Retry-After', 'RateLimit', 'RateLimit-Policy'],
      maxAge: 600,
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

let serverlessApp: Express | undefined;

/**
 * Vercel entrypoint: the Express preset deploys this file (the first one importing `express`) and
 * calls its default export per request. `server.ts` remains the long-running entrypoint. The app
 * is built on first request so importing `createApp` elsewhere doesn't construct a second one.
 */
export default function serverlessHandler(req: IncomingMessage, res: ServerResponse): void {
  serverlessApp ??= createApp();
  serverlessApp(req, res);
}
