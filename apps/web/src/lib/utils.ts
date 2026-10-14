import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` taught the ASRA theme extensions in globals.css, so that e.g.
 * `cn('h-control', 'h-control-lg')` keeps only the last value and `type-*` roles override each other.
 */
const twMerge = extendTailwindMerge<'type-role'>({
  extend: {
    theme: {
      spacing: ['gutter', 'section', 'control-sm', 'control', 'control-lg', 'sidebar', 'topbar'],
      shadow: ['card', 'raised', 'overlay'],
      container: ['page', 'narrow', 'prose-content'],
      ease: ['standard', 'emphasized'],
      animate: ['fade-in', 'fade-up', 'scale-in', 'page-in'],
    },
    classGroups: {
      'type-role': [
        {
          type: [
            'display',
            'h1',
            'h2',
            'h3',
            'h4',
            'body-lg',
            'body',
            'body-sm',
            'caption',
            'label',
            'eyebrow',
          ],
        },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Up to two initials from a display name, for avatar fallbacks. Empty input → "?". */
export function getInitials(name: string | null | undefined): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0]!;
  const last = words.length > 1 ? words[words.length - 1]! : '';
  return (Array.from(first)[0]! + (last ? Array.from(last)[0]! : '')).toUpperCase();
}

/**
 * Normalises a progress value into the 0…max range. Missing or non-finite values return `null`
 * so callers can show an explicit "no data" state instead of a misleading 0%.
 */
export function clampProgress(value: number | null | undefined, max = 100): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  return Math.min(Math.max(value, 0), safeMax);
}

/** Percentage (0–100, rounded) for a value already clamped by `clampProgress`. */
export function toPercent(value: number, max = 100): number {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100;
  return Math.round((value / safeMax) * 100);
}
