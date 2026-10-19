import { env } from '../../config/env.js';
import type { PaymentMode } from '../../generated/prisma/client.js';
import { AppError } from '../../utils/app-error.js';
import type { PaymentGateway } from './gateway.js';
import { createRazorpayGateway } from './razorpay.gateway.js';
import { verifyCheckoutSignature, verifyWebhookSignature } from './signatures.js';

/**
 * Credential selection (docs/PAYMENTS.md §2). The ONLY place that reads Razorpay secrets.
 *
 * - `activeMode` decides the mode of NEW orders (RAZORPAY_MODE). Unset → checkout disabled.
 * - Existing orders, payments and refunds are always processed by `account(order.mode)` — a
 *   deployment that switches from test to live never verifies an old test order with live keys
 *   (or vice versa). If that mode's keys are no longer configured, processing fails safely (503).
 * - Webhooks are verified with the secret of the mode named in the webhook URL.
 */

export interface PaymentAccount {
  readonly mode: PaymentMode;
  readonly keyId: string;
  readonly gateway: PaymentGateway;
  verifyCheckoutSignature(
    providerOrderId: string,
    providerPaymentId: string,
    signature: string,
  ): boolean;
  /** `null` when no webhook secret is configured for this mode. */
  readonly webhook: { verify(rawBody: Buffer, signature: string): boolean } | null;
}

export interface PaymentAccountCredentials {
  keyId: string;
  keySecret: string;
  webhookSecret?: string;
  /** Tests inject an in-memory gateway; production always uses the Razorpay REST gateway. */
  gateway?: PaymentGateway;
}

function buildAccount(mode: PaymentMode, credentials: PaymentAccountCredentials): PaymentAccount {
  const { keyId, keySecret, webhookSecret } = credentials;
  return {
    mode,
    keyId,
    gateway: credentials.gateway ?? createRazorpayGateway({ mode, keyId, keySecret }),
    verifyCheckoutSignature: (orderId, paymentId, signature) =>
      verifyCheckoutSignature(keySecret, orderId, paymentId, signature),
    webhook: webhookSecret
      ? {
          verify: (rawBody, signature) => verifyWebhookSignature(webhookSecret, rawBody, signature),
        }
      : null,
  };
}

function fromEnv(): {
  activeMode: PaymentMode | null;
  accounts: Partial<Record<PaymentMode, PaymentAccount>>;
} {
  const accounts: Partial<Record<PaymentMode, PaymentAccount>> = {};
  const read = (mode: PaymentMode) => {
    const prefix = mode === 'TEST' ? 'RAZORPAY_TEST' : 'RAZORPAY_LIVE';
    const keyId = env[`${prefix}_KEY_ID`]?.trim();
    const keySecret = env[`${prefix}_KEY_SECRET`]?.trim();
    if (keyId && keySecret) {
      accounts[mode] = buildAccount(mode, {
        keyId,
        keySecret,
        webhookSecret: env[`${prefix}_WEBHOOK_SECRET`]?.trim() || undefined,
      });
    }
  };
  read('TEST');
  // A live account is only ever built in production (env.ts refuses RAZORPAY_MODE=live
  // elsewhere; this also keeps stray live keys on a developer machine inert).
  if (env.isProduction) read('LIVE');
  const activeMode =
    env.RAZORPAY_MODE === 'live' ? 'LIVE' : env.RAZORPAY_MODE === 'test' ? 'TEST' : null;
  return { activeMode, accounts };
}

let state = fromEnv();

export const paymentsConfig = {
  /** Mode of new orders, or null when online checkout is disabled. */
  activeMode(): PaymentMode | null {
    return state.activeMode && state.accounts[state.activeMode] ? state.activeMode : null;
  },

  checkoutEnabled(): boolean {
    return paymentsConfig.activeMode() !== null;
  },

  /** The account of an EXISTING row's mode, or null when that mode is not configured here. */
  account(mode: PaymentMode): PaymentAccount | null {
    return state.accounts[mode] ?? null;
  },

  /** Like `account`, but a missing configuration is a 503 for the caller. */
  requireAccount(mode: PaymentMode): PaymentAccount {
    const account = state.accounts[mode];
    if (!account) {
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        mode === state.activeMode || state.activeMode === null
          ? 'Online payments are not available right now. Please try again later.'
          : 'This order was created in a different payment environment and cannot be processed here.',
      );
    }
    return account;
  },

  /** The account for new orders; 503 when checkout is disabled (never a silent fallback). */
  requireActiveAccount(): PaymentAccount {
    const mode = paymentsConfig.activeMode();
    if (!mode) {
      throw new AppError(
        'SERVICE_UNAVAILABLE',
        'Online payment is not available yet. Please contact the academy to enrol.',
      );
    }
    return state.accounts[mode]!;
  },

  /** Which modes are configured (for the admin screen) — never the values. */
  describe() {
    return (['TEST', 'LIVE'] as const).map((mode) => ({
      mode,
      configured: Boolean(state.accounts[mode]),
      webhookConfigured: Boolean(state.accounts[mode]?.webhook),
    }));
  },
};

/**
 * Replaces the configuration with in-memory accounts (or restores the environment with `null`).
 * Test-only: throws outside NODE_ENV=test so production can never be pointed at a fake gateway.
 */
export function setPaymentAccountsForTests(
  next: {
    activeMode: PaymentMode | null;
    accounts: Partial<Record<PaymentMode, PaymentAccountCredentials>>;
  } | null,
): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setPaymentAccountsForTests is only available in tests');
  }
  if (next === null) {
    state = fromEnv();
    return;
  }
  const accounts: Partial<Record<PaymentMode, PaymentAccount>> = {};
  for (const mode of ['TEST', 'LIVE'] as const) {
    const credentials = next.accounts[mode];
    if (credentials) accounts[mode] = buildAccount(mode, credentials);
  }
  state = { activeMode: next.activeMode, accounts };
}
