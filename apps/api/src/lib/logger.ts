import { pino, type LoggerOptions } from 'pino';
import { env } from '../config/env.js';

/** Field names that must never reach a log line, at the top level or one level deep. */
const SENSITIVE_FIELDS = [
  'password',
  'passwordHash',
  'token',
  'tokenHash',
  'accessToken',
  'refreshToken',
  'secret',
  'cookie',
];

/**
 * Redaction applied to every log line. Request/response serializers already log only
 * id/method/url/status, so these paths guard against accidental `logger.info({ ...body })`.
 */
export const LOG_REDACTION: NonNullable<LoggerOptions['redact']> = {
  paths: [
    'req.headers.authorization',
    'req.headers.cookie',
    'res.headers["set-cookie"]',
    ...SENSITIVE_FIELDS,
    ...SENSITIVE_FIELDS.map((field) => `*.${field}`),
  ],
  censor: '[REDACTED]',
};

export const logger = pino({
  level: env.LOG_LEVEL,
  base: { service: 'asra-api' },
  redact: LOG_REDACTION,
  ...(env.isDevelopment
    ? {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname,service' },
        },
      }
    : {}),
});
