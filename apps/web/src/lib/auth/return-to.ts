'use client';

import * as React from 'react';

import { safeNextPath } from '@/lib/admin/format';

/**
 * Keeps the page a visitor wanted (e.g. `/student/checkout/<course>`) across registration and the
 * email-verification link, which may open in another tab — so it lives in localStorage with a
 * short expiry. Only a same-site PATH is ever stored or returned (`safeNextPath`, no open
 * redirects), and nothing else: the checkout page re-fetches the course and the server re-prices
 * it, so no amount, discount or course data is trusted from the browser.
 */

const KEY = 'asra:return-to';
const TTL_MS = 24 * 60 * 60 * 1000;

export function rememberReturnTo(path: string | null | undefined): void {
  const safe = path ? safeNextPath(path, '') : '';
  if (!safe) return;
  try {
    localStorage.setItem(KEY, JSON.stringify({ path: safe, at: Date.now() }));
  } catch {
    // Storage unavailable (private mode): the student simply lands on their dashboard.
  }
}

export function recallReturnTo(): string | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const { path, at } = JSON.parse(raw) as { path?: unknown; at?: unknown };
    if (typeof path !== 'string' || typeof at !== 'number' || Date.now() - at > TTL_MS) {
      localStorage.removeItem(KEY);
      return null;
    }
    return safeNextPath(path, '') || null;
  } catch {
    return null;
  }
}

export function forgetReturnTo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}

export function loginHref(next: string | null | undefined): string {
  const safe = next ? safeNextPath(next, '') : '';
  return safe ? `/login?next=${encodeURIComponent(safe)}` : '/login';
}

const noSubscription = () => () => {};

/** `/login` on the server render, `/login?next=…` in the browser when a return path is stored. */
export function useRememberedLoginHref(): string {
  return React.useSyncExternalStore(
    noSubscription,
    () => loginHref(recallReturnTo()),
    () => '/login',
  );
}
