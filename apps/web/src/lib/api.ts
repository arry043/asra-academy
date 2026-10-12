import type { ApiResponse, HealthData } from '@asra/types';
import { publicEnv } from './env';

export type ApiHealthResult =
  { ok: true; message: string; data: HealthData } | { ok: false; message: string };

/** Fetches the API liveness endpoint. Never throws — the page renders either way. */
export async function getApiHealth(): Promise<ApiHealthResult> {
  try {
    const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3_000),
    });
    const body = (await response.json()) as ApiResponse<HealthData>;
    return body.success
      ? { ok: true, message: body.message, data: body.data }
      : { ok: false, message: body.message };
  } catch {
    return { ok: false, message: 'API is not reachable' };
  }
}
