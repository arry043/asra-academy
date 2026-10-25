import type {
  CourseVisibility,
  DiscountType,
  LessonContentType,
  PublicationStatus,
  ResourceKind,
} from '@asra/types';

/**
 * Labels and conversions for the admin portal (PHASE 06). Pure functions — shared by forms,
 * tables and tests.
 */

export const STATUS_LABELS: Record<PublicationStatus, string> = {
  DRAFT: 'Draft',
  PUBLISHED: 'Published',
  ARCHIVED: 'Archived',
};

export const STATUS_BADGE: Record<PublicationStatus, 'warning' | 'success' | 'secondary'> = {
  DRAFT: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'secondary',
};

/** Visibility semantics, worded for administrators (docs/COURSE-MANAGEMENT.md §3.1). */
export const VISIBILITY_OPTIONS: Record<CourseVisibility, { label: string; description: string }> =
  {
    PUBLIC: {
      label: 'Public',
      description: 'When published, listed in the course catalogue and open to everyone.',
    },
    UNLISTED: {
      label: 'Unlisted',
      description:
        'When published, not listed in the catalogue; only people with the link can open it. Hidden from search engines.',
    },
    PRIVATE: {
      label: 'Private',
      description: 'Never shown on the public website, even when published.',
    },
  };

export const LESSON_TYPE_LABELS: Record<LessonContentType, string> = {
  VIDEO: 'Video',
  PDF: 'PDF',
  DOCUMENT: 'Document',
  LINK: 'External resource',
  QUIZ: 'Quiz',
  ASSIGNMENT: 'Assignment',
  TEXT: 'Text',
};

export const RESOURCE_TYPE_LABELS: Record<ResourceKind, string> = {
  VIDEO: 'Video',
  PDF: 'PDF',
  DOCUMENT: 'Document',
  PRESENTATION: 'Presentation',
  IMAGE: 'Image',
  AUDIO: 'Audio',
  EXTERNAL_LINK: 'External link',
  OTHER: 'Other',
};

/** Resource type suggested when adding a resource to a lesson of this type. */
export const DEFAULT_RESOURCE_TYPE: Record<LessonContentType, ResourceKind> = {
  VIDEO: 'VIDEO',
  PDF: 'PDF',
  DOCUMENT: 'DOCUMENT',
  LINK: 'EXTERNAL_LINK',
  QUIZ: 'DOCUMENT',
  ASSIGNMENT: 'PDF',
  TEXT: 'OTHER',
};

/** Minor units per major unit. All supported currencies (INR, M-03) use 2 decimals. */
const MINOR_PER_MAJOR = 100;

/**
 * Parses an amount typed by an administrator ("2500", "2,500.50") into minor units.
 * Returns `null` for an empty input and `undefined` when the text is not a valid amount
 * (negative numbers, more than two decimals, letters…). Never rounds silently.
 */
export function parseMoneyInput(text: string): number | null | undefined {
  const cleaned = text.replace(/[,\s]/g, '');
  if (cleaned === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return undefined;
  const [whole = '0', fraction = ''] = cleaned.split('.');
  return Number(whole) * MINOR_PER_MAJOR + Number(fraction.padEnd(2, '0'));
}

/** Minor units → the text shown in an amount input ("250000" → "2500.00"). */
export function minorToInput(minor: number | null | undefined): string {
  if (minor === null || minor === undefined) return '';
  return (minor / MINOR_PER_MAJOR).toFixed(2);
}

/** "₹2,500.00" — or "Free" for 0, or `null` when no price is set. */
export function formatMoney(minor: number | null, currency: string | null): string | null {
  if (minor === null || currency === null) return null;
  if (minor === 0) return 'Free';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(
    minor / MINOR_PER_MAJOR,
  );
}

/** "10% off" / "₹500.00 off" — or `null` without a discount. No final price is computed. */
export function formatDiscount(
  type: DiscountType | null,
  value: number | null,
  currency: string | null,
): string | null {
  if (type === null || value === null) return null;
  if (type === 'PERCENTAGE') return `${value}% off`;
  return `${formatMoney(value, currency) ?? value} off`;
}

/** Splits minutes into the hours/minutes inputs of the course form. */
export function splitMinutes(total: number | null): { hours: string; minutes: string } {
  if (total === null) return { hours: '', minutes: '' };
  return { hours: String(Math.floor(total / 60)), minutes: String(total % 60) };
}

/**
 * Combines the hours/minutes inputs. `null` when both are empty, `undefined` when either is not a
 * whole non-negative number.
 */
export function joinMinutes(hours: string, minutes: string): number | null | undefined {
  if (hours.trim() === '' && minutes.trim() === '') return null;
  const h = hours.trim() === '' ? 0 : Number(hours);
  const m = minutes.trim() === '' ? 0 : Number(minutes);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0) return undefined;
  return h * 60 + m;
}

/** Control characters, DEL and backslashes: the URL parser strips or reinterprets them. */
function hasUnsafePathCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

const SAME_ORIGIN_PROBE = 'https://same-origin.invalid';

/**
 * Validates a post-login redirect target. Only same-site absolute paths are allowed — never
 * `//host`, `/\host` or full URLs — so `?next=` cannot be used as an open redirect.
 *
 * PHASE 14: browsers drop tabs/newlines while parsing, so `/\t/evil.example` would become
 * `//evil.example`; such characters are refused, and the WHATWG parser must agree the result
 * stays on this origin.
 */
export function safeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || hasUnsafePathCharacter(value)) {
    return fallback;
  }
  try {
    if (new URL(value, SAME_ORIGIN_PROBE).origin !== SAME_ORIGIN_PROBE) return fallback;
  } catch {
    return fallback;
  }
  return value;
}

/** Moves `items[index]` by `delta` and returns the new order (or `null` at the edges). */
export function moveItem<T>(items: readonly T[], index: number, delta: -1 | 1): T[] | null {
  const target = index + delta;
  if (target < 0 || target >= items.length) return null;
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}
