/**
 * WhatsApp click-to-chat links (REQ-COM-001). The integration type is assumed to be a plain
 * `wa.me` link until the client decides otherwise (CLIENT-CLARIFICATIONS P-01).
 */

const WHATSAPP_NUMBER_PATTERN = /^[1-9]\d{7,14}$/;

/** Longest prefilled message we put in a URL (keeps links well under URL length limits). */
export const WHATSAPP_MESSAGE_MAX_LENGTH = 500;

/**
 * Builds `https://wa.me/<number>?text=<message>`. Returns `null` when the number is missing or
 * not 8–15 digits in international format, so callers render no CTA rather than a broken link.
 * The message is URL-encoded; never put personal data (names, phone numbers) in it — the URL is
 * visible in history and to WhatsApp.
 */
export function buildWhatsAppUrl(
  number: string | null | undefined,
  message?: string,
): string | null {
  const digits = number?.replace(/[\s()+-]/g, '') ?? '';
  if (!WHATSAPP_NUMBER_PATTERN.test(digits)) return null;
  const url = new URL(`https://wa.me/${digits}`);
  const text = message?.trim().slice(0, WHATSAPP_MESSAGE_MAX_LENGTH);
  if (text) url.searchParams.set('text', text);
  // URLSearchParams encodes spaces as "+", which WhatsApp shows literally; use %20 instead.
  return url.toString().replace(/\+/g, '%20');
}

/** Prefilled opening line for an enquiry about a topic (no personal data). */
export function whatsAppEnquiryMessage(topic?: string): string {
  return topic
    ? `Hello, I would like to know more about ${topic} at ASRA Academy.`
    : 'Hello, I would like to know more about ASRA Academy.';
}
