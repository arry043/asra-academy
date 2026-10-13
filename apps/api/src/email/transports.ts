import type { Logger } from 'pino';
import type { EmailMessage, EmailTransport } from './email.types.js';

type SentMessage = EmailMessage & { from: string };

/**
 * DEVELOPMENT ONLY. Prints each message — including its one-time link — to the API log so the
 * flows can be exercised locally without an email provider. Nothing is sent anywhere.
 * src/config/env.ts refuses to start in production with this transport.
 */
export function createConsoleTransport(logger: Logger): EmailTransport {
  return {
    name: 'console',
    async send(message: SentMessage) {
      logger.info(
        { devEmail: { template: message.template, to: message.to, subject: message.subject } },
        `[DEV EMAIL — not sent]\n${message.text}`,
      );
    },
  };
}

/** TESTS ONLY. Keeps messages in memory so tests can read the links that would be emailed. */
export function createMemoryTransport(): EmailTransport & { outbox: SentMessage[] } {
  const outbox: SentMessage[] = [];
  return {
    name: 'memory',
    outbox,
    async send(message: SentMessage) {
      outbox.push(message);
    },
  };
}
