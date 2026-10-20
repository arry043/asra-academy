import type { Logger } from 'pino';
import { Resend } from 'resend';
import { withTimeout } from '../utils/with-timeout.js';
import type { EmailMessage, EmailReceipt, EmailTransport } from './email.types.js';

type SentMessage = EmailMessage & { from: string };

/** Upper bound for one provider call, so a hung request cannot stall the auth endpoint. */
const RESEND_SEND_TIMEOUT_MS = 10_000;

/** The part of the Resend SDK this transport uses (tests inject a fake; no network needed). */
export interface ResendClient {
  emails: {
    send(
      payload: { from: string; to: string; subject: string; text: string; html?: string },
      options?: { idempotencyKey?: string },
    ): Promise<{
      data: { id: string } | null;
      error: { name: string; statusCode: number | null; message: string } | null;
    }>;
  };
}

/**
 * Resend errors that will fail again on retry (malformed request / invalid recipient). Auth and
 * domain errors (401/403) are treated as retryable: they are configuration problems an operator
 * can fix while the bounded retries are still running.
 */
export function isPermanentResendError(error: unknown): boolean {
  return (
    error instanceof ResendDeliveryError && (error.statusCode === 400 || error.statusCode === 422)
  );
}

/**
 * Raised when Resend does not accept a message. Carries only Resend's error code and HTTP status:
 * the provider's free-text message can echo the recipient address, and the API key never appears.
 */
export class ResendDeliveryError extends Error {
  readonly code: string;
  readonly statusCode: number | null;

  constructor(code: string, statusCode: number | null) {
    super(`Resend did not accept the message (${code}, status ${statusCode ?? 'none'})`);
    this.name = 'ResendDeliveryError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * PRODUCTION. Hands each message to Resend. The SDK reports API and network failures as a returned
 * `error` instead of throwing, so this converts them into a throw (the EmailTransport contract).
 * Success means Resend accepted the message, not that it reached the inbox.
 */
export function createResendTransport(options: {
  apiKey: string;
  client?: ResendClient;
  timeoutMs?: number;
}): EmailTransport {
  // The key is passed explicitly (validated in src/config/env.ts), so the SDK's implicit
  // RESEND_API_KEY fallback never applies.
  const client = options.client ?? new Resend(options.apiKey);
  const timeoutMs = options.timeoutMs ?? RESEND_SEND_TIMEOUT_MS;

  return {
    name: 'resend',
    async send(message: SentMessage): Promise<EmailReceipt> {
      const { data, error } = await withTimeout(
        client.emails.send(
          {
            from: message.from,
            to: message.to,
            subject: message.subject,
            text: message.text,
            ...(message.html ? { html: message.html } : {}),
          },
          message.idempotencyKey ? { idempotencyKey: message.idempotencyKey } : undefined,
        ),
        timeoutMs,
        'Resend email request',
      );
      if (error) throw new ResendDeliveryError(error.name, error.statusCode);
      return { providerMessageId: data?.id ?? null };
    },
  };
}

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
    async send(message: SentMessage): Promise<EmailReceipt> {
      outbox.push(message);
      return { providerMessageId: `memory-${outbox.length}` };
    },
  };
}
