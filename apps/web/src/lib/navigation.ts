import type * as React from 'react';

export interface NavItem {
  label: string;
  href: string;
  /** Icon element, e.g. `<BookOpen />` (elements — not components — so server code can pass them). */
  icon?: React.ReactNode;
  /** Short text badge, e.g. a count from real data. */
  badge?: string;
  /** Match only the exact path (use for index routes such as "/" or "/dashboard"). */
  exact?: boolean;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

/**
 * Whether a nav item is the current location. Index routes need `exact` so "/" does not match
 * every page; other items also match their sub-paths ("/courses" ↔ "/courses/english").
 */
export function isActivePath(pathname: string | null, href: string, exact = false): boolean {
  if (!pathname) return false;
  const path = stripTrailingSlash(pathname.split(/[?#]/)[0] ?? '');
  const target = stripTrailingSlash(href.split(/[?#]/)[0] ?? '');
  if (exact || target === '/') return path === target;
  return path === target || path.startsWith(`${target}/`);
}

function stripTrailingSlash(value: string): string {
  return value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value || '/';
}
