import {
  PROGRAMME_CATEGORIES,
  programmes,
  type Programme,
  type ProgrammeCategory,
} from '@/content/programmes';
import type { CourseSummary } from '@/types/education';

/** Course-directory filter state. `category: 'all'` means no category filter. */
export interface ProgrammeFilters {
  query: string;
  category: ProgrammeCategory | 'all';
}

export const DEFAULT_PROGRAMME_FILTERS: ProgrammeFilters = { query: '', category: 'all' };

/** Longest search query accepted from the URL or the input. */
export const MAX_QUERY_LENGTH = 80;

export function isProgrammeCategory(value: unknown): value is ProgrammeCategory {
  return typeof value === 'string' && Object.hasOwn(PROGRAMME_CATEGORIES, value);
}

/**
 * Reads filters from URL search params. Untrusted input: unknown categories fall back to "all"
 * and the query is trimmed and length-capped. It is only ever compared as text, never rendered as
 * HTML or sent anywhere.
 */
export function parseProgrammeFilters(params: {
  get(name: string): string | null;
}): ProgrammeFilters {
  const category = params.get('category');
  return {
    query: (params.get('q') ?? '').trim().slice(0, MAX_QUERY_LENGTH),
    category: isProgrammeCategory(category) ? category : 'all',
  };
}

/** The canonical query string for a filter state ("" when nothing is filtered). */
export function toProgrammeSearchParams(filters: ProgrammeFilters): string {
  const params = new URLSearchParams();
  const query = filters.query.trim();
  if (query) params.set('q', query);
  if (filters.category !== 'all') params.set('category', filters.category);
  return params.toString();
}

/** Case-, accent- and punctuation-insensitive text for matching ("Tajwīd" → "tajwid"). */
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function searchableText(programme: Programme): string {
  return normalizeSearchText(
    [
      programme.title,
      programme.summary,
      PROGRAMME_CATEGORIES[programme.category],
      programme.curriculum ?? '',
      ...programme.topics,
      ...(programme.candidateSubjects ?? []),
    ].join(' '),
  );
}

/**
 * Applies search and category together. Every word of the query must appear in the programme's
 * title, summary, category, topics or (provisional) subjects; word order does not matter.
 */
export function filterProgrammes(
  items: readonly Programme[],
  filters: ProgrammeFilters,
): Programme[] {
  const words = normalizeSearchText(filters.query).split(' ').filter(Boolean);
  return items.filter((programme) => {
    if (filters.category !== 'all' && programme.category !== filters.category) return false;
    if (words.length === 0) return true;
    const text = searchableText(programme);
    return words.every((word) => text.includes(word));
  });
}

/** Number of programmes per category, for filter labels. */
export function countByCategory(
  items: readonly Programme[],
): Record<ProgrammeCategory | 'all', number> {
  const counts = { all: items.length, school: 0, language: 0, business: 0, quranic: 0 };
  for (const item of items) counts[item.category] += 1;
  return counts;
}

export function getProgramme(slug: string): Programme | undefined {
  return programmes.find((programme) => programme.slug === slug);
}

export function getProgrammesByKind(kind: Programme['kind']): Programme[] {
  return programmes.filter((programme) => programme.kind === kind);
}

/** Other programmes to suggest: same category first, then the rest, in catalogue order. */
export function getRelatedProgrammes(slug: string, limit = 3): Programme[] {
  const current = getProgramme(slug);
  const others = programmes.filter((programme) => programme.slug !== slug);
  if (!current) return others.slice(0, limit);
  const sameCategory = others.filter((programme) => programme.category === current.category);
  const rest = others.filter((programme) => programme.category !== current.category);
  return [...sameCategory, ...rest].slice(0, limit);
}

/** Maps a programme onto the shared `CourseCard` view model (no invented metadata). */
export function toCourseSummary(programme: Programme): CourseSummary {
  return {
    title: programme.title,
    category: PROGRAMME_CATEGORIES[programme.category],
    subject: programme.curriculum,
    summary: programme.summary,
    // Short label so it fits narrow 4-column cards; the card title gives the link its context.
    action: {
      href: programme.href,
      label: programme.kind === 'class-band' ? 'View classes' : 'View course',
    },
  };
}
