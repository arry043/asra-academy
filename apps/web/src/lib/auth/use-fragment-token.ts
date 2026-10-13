'use client';

import * as React from 'react';

let captured: string | null = null;

/**
 * Reads the one-time token from the emailed link's URL fragment (`#token=…`). The first read
 * captures it and removes it from the address bar (so it is not kept in history or shared by
 * copy-paste); later reads return the captured value. Idempotent, so safe to call during render.
 */
function getSnapshot(): string | null {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('token');
  if (token) {
    captured = token;
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
  return captured;
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
};

/** `undefined` while server-rendering/hydrating, then the token or `null` if the link had none. */
export function useFragmentToken(): string | null | undefined {
  return React.useSyncExternalStore(subscribe, getSnapshot, () => undefined);
}

/** Forget the captured token once it has been used. */
export function clearFragmentToken(): void {
  captured = null;
}
