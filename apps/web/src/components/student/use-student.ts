'use client';

import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';

/**
 * Data access for the student portal: a thin layer over `authorizedRequest` (in-memory access
 * token, one refresh on 401), the same approach as the admin portal (TanStack Query is not part of
 * the approved stack yet). The API decides what the student may see; nothing here is a security
 * boundary.
 */
export { errorMessage, useApiResource } from '@/components/admin/use-admin';

export function useStudentApi() {
  const { authorizedRequest } = useAuth();
  return React.useMemo(
    () => ({
      get: <T>(path: string) => authorizedRequest<T>(path),
      post: <T>(path: string, body?: unknown) =>
        authorizedRequest<T>(path, { method: 'POST', ...(body === undefined ? {} : { body }) }),
      put: <T>(path: string, body: unknown) => authorizedRequest<T>(path, { method: 'PUT', body }),
      patch: <T>(path: string, body: unknown) =>
        authorizedRequest<T>(path, { method: 'PATCH', body }),
      del: <T>(path: string) => authorizedRequest<T>(path, { method: 'DELETE' }),
    }),
    [authorizedRequest],
  );
}

export type StudentApi = ReturnType<typeof useStudentApi>;

/** `?page=` helper for paginated lists. */
export function withPage(path: string, page: number, extra: Record<string, string> = {}) {
  const params = new URLSearchParams({ page: String(page), ...extra });
  return `${path}?${params.toString()}`;
}
