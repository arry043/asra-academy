import crypto from 'node:crypto';

/**
 * Base32-style alphabet excluding easily confused characters (0, O, 1, I, L, U): 30 symbols,
 * ~4.9 bits per character. 8 characters ≈ 39 bits (30^8 ≈ 6.6 × 10^11 numbers per year).
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
  let randomPart = '';

  // randomInt is uniform (rejection sampling); `byte % 30` would favour the first 16 symbols.
  for (let i = 0; i < 8; i++) {
    randomPart += CROCKFORD_ALPHABET[crypto.randomInt(CROCKFORD_ALPHABET.length)];
  }

  const segment1 = randomPart.slice(0, 4);
  const segment2 = randomPart.slice(4, 8);

  return `ASRA-${year}-${segment1}-${segment2}`;
}

export function isValidCertificateNumber(value: string): boolean {
  return CERTIFICATE_NUMBER_REGEX.test(value);
}
