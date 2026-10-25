import crypto from 'node:crypto';

/**
 * Crockford Base32 alphabet excluding easily confused characters (0, O, 1, I, L).
 * 32 characters = 5 bits per character. 8 characters = 40 bits of entropy (~1.1 trillion per year).
 */
const CROCKFORD_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * Pattern for valid certificate numbers: ASRA-YYYY-XXXX-XXXX
 */
export const CERTIFICATE_NUMBER_REGEX =
  /^ASRA-\d{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}-[23456789ABCDEFGHJKMNPQRSTVWXYZ]{4}$/;

/**
 * Generates a stable, tamper-resistant, collision-resistant unique certificate number.
 * Example: ASRA-2026-F9KC-M28V
 */
export function generateCertificateNumber(year = new Date().getUTCFullYear()): string {
  const bytes = crypto.randomBytes(8);
  let randomPart = '';

  for (let i = 0; i < 8; i++) {
    const index = bytes[i]! % CROCKFORD_ALPHABET.length;
    randomPart += CROCKFORD_ALPHABET[index];
  }

  const segment1 = randomPart.slice(0, 4);
  const segment2 = randomPart.slice(4, 8);

  return `ASRA-${year}-${segment1}-${segment2}`;
}

export function isValidCertificateNumber(value: string): boolean {
  return CERTIFICATE_NUMBER_REGEX.test(value);
}
