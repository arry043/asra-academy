import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay signature checks (docs/PAYMENTS.md §6–7).
 *
 * - Checkout: HMAC-SHA256(key_secret, `${order_id}|${razorpay_payment_id}`) as hex, where
 *   `order_id` is the provider order id WE stored — never the one echoed by the browser.
 * - Webhook: HMAC-SHA256(webhook_secret, raw request body) as hex, from `X-Razorpay-Signature`.
 *   It must be computed over the exact bytes received, never a re-serialised JSON object.
 *
 * Comparisons are constant-time. Malformed signatures (wrong length / not hex) are rejected
 * without comparing.
 */

const HEX_SHA256 = /^[0-9a-f]{64}$/;

export function hmacSha256Hex(secret: string, message: string | Buffer): string {
  return createHmac('sha256', secret).update(message).digest('hex');
}

function safeEqualHex(expectedHex: string, receivedHex: string): boolean {
  if (!HEX_SHA256.test(receivedHex)) return false;
  return timingSafeEqual(Buffer.from(expectedHex, 'hex'), Buffer.from(receivedHex, 'hex'));
}

export function verifyCheckoutSignature(
  keySecret: string,
  providerOrderId: string,
  providerPaymentId: string,
  signature: string,
): boolean {
  return safeEqualHex(
    hmacSha256Hex(keySecret, `${providerOrderId}|${providerPaymentId}`),
    signature.trim().toLowerCase(),
  );
}

export function verifyWebhookSignature(
  webhookSecret: string,
  rawBody: Buffer,
  signature: string,
): boolean {
  return safeEqualHex(hmacSha256Hex(webhookSecret, rawBody), signature.trim().toLowerCase());
}
