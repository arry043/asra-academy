import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';
import type { EmailMessage, EmailTransport } from './email.types.js';
import {
  createConsoleTransport,
  createMemoryTransport,
  createResendTransport,
} from './transports.js';

/** Thrown when a message could not be handed to the provider. Carries no token or address. */
export class EmailDeliveryError extends Error {
  constructor(template: EmailMessage['template'], options?: { cause?: unknown }) {
    super(`Email delivery failed (${template})`, options);
    this.name = 'EmailDeliveryError';
  }
}

/** In tests, exposes the memory transport's outbox. `undefined` for other transports. */
export const memoryTransport =
  env.EMAIL_TRANSPORT === 'memory' ? createMemoryTransport() : undefined;

function createConfiguredTransport(): EmailTransport {
  if (memoryTransport) return memoryTransport;
  if (env.EMAIL_TRANSPORT === 'resend') {
    // src/config/env.ts already refuses to start without a key; this guards against drift.
    if (!env.EMAIL_API_KEY) throw new Error('EMAIL_API_KEY is required for EMAIL_TRANSPORT=resend');
    return createResendTransport({ apiKey: env.EMAIL_API_KEY });
  }
  return createConsoleTransport(logger);
}

let transport: EmailTransport = createConfiguredTransport();

/** Replaces the transport (tests use this to simulate provider failures). */
export function setEmailTransport(next: EmailTransport): EmailTransport {
  const previous = transport;
  transport = next;
  return previous;
}

/**
 * Links put the token in the URL *fragment* (`#token=…`): fragments are never sent to servers,
 * so the token stays out of web-server logs, proxies and Referer headers.
 */
function appLink(path: string, token: string): string {
  return `${new URL(path, env.NEXT_PUBLIC_APP_URL).toString()}#token=${token}`;
}

function hoursLabel(minutes: number): string {
  return minutes % 60 === 0 ? `${minutes / 60} hour(s)` : `${minutes} minutes`;
}

async function deliver(message: EmailMessage): Promise<void> {
  try {
    await transport.send({ ...message, from: env.EMAIL_FROM });
  } catch (error) {
    // Structured log without the message body (it contains the one-time link).
    logger.error(
      { err: error, template: message.template, transport: transport.name },
      'Email delivery failed',
    );
    throw new EmailDeliveryError(message.template, { cause: error });
  }
}

/** Authentication emails. Business code depends on this API, never on a provider SDK. */
export const emailService = {
  sendEmailVerification(to: string, fullName: string, token: string): Promise<void> {
    const link = appLink('/verify-email', token);
    return deliver({
      to,
      template: 'email-verification',
      subject: 'Verify your ASRA Academy email address',
      text: [
        `Hello ${fullName},`,
        '',
        'Please confirm your email address to activate your ASRA Academy account:',
        link,
        '',
        `This link expires in ${hoursLabel(env.EMAIL_VERIFICATION_TTL_HOURS * 60)} and can be used once.`,
        'If you did not create an account, you can ignore this email.',
      ].join('\n'),
    });
  },

  sendPasswordReset(to: string, fullName: string, token: string): Promise<void> {
    const link = appLink('/reset-password', token);
    return deliver({
      to,
      template: 'password-reset',
      subject: 'Reset your ASRA Academy password',
      text: [
        `Hello ${fullName},`,
        '',
        'We received a request to reset your password. Choose a new one here:',
        link,
        '',
        `This link expires in ${hoursLabel(env.PASSWORD_RESET_TTL_MINUTES)} and can be used once.`,
        'Resetting your password signs you out on all devices.',
        'If you did not request this, you can ignore this email — your password is unchanged.',
      ].join('\n'),
    });
  },

  /** Sent instead of a verification email when someone registers with an existing address. */
  sendAccountExistsNotice(to: string, fullName: string): Promise<void> {
    return deliver({
      to,
      template: 'account-exists',
      subject: 'Your ASRA Academy account',
      text: [
        `Hello ${fullName},`,
        '',
        'Someone tried to create a new ASRA Academy account with this email address,',
        'but an account already exists. If this was you, sign in instead:',
        new URL('/login', env.NEXT_PUBLIC_APP_URL).toString(),
        '',
        'Forgot your password? Use "Forgot password" on the sign-in page.',
        'If this was not you, no action is needed.',
      ].join('\n'),
    });
  },
};
