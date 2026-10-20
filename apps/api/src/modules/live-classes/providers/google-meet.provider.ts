import { z } from 'zod';
import { GOOGLE_API_TIMEOUT_MS } from '../../../config/constants.js';
import { env } from '../../../config/env.js';
import { withTimeout } from '../../../utils/with-timeout.js';
import {
  MeetingProviderError,
  type CreatedMeeting,
  type MeetingProvider,
} from './meeting-provider.js';

/**
 * Google Meet REST API adapter (docs/LIVE-CLASSES.md §4).
 *
 *   - `POST https://meet.googleapis.com/v2/spaces` creates a meeting space and returns its
 *     resource `name` ("spaces/{id}") and `meetingUri` (https://meet.google.com/…).
 *   - The Meet REST API accepts USER authentication only (an OAuth user grant, or a Workspace
 *     service account with domain-wide delegation impersonating a user). This adapter uses an
 *     OAuth 2.0 refresh token of the Google account that will own the meetings, exchanged at
 *     `https://oauth2.googleapis.com/token` for short-lived access tokens (cached in memory).
 *   - Required scope: `https://www.googleapis.com/auth/meetings.space.created` (sensitive).
 *
 * Credentials never leave the server and are never logged; errors carry staff-safe messages.
 */

export const GOOGLE_MEET_SCOPE = 'https://www.googleapis.com/auth/meetings.space.created';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SPACES_URL = 'https://meet.googleapis.com/v2/spaces';
/** Refresh a cached token this long before Google says it expires. */
const TOKEN_SKEW_MS = 60_000;

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string().optional(),
});

const spaceResponseSchema = z.object({
  name: z.string().regex(/^spaces\/[A-Za-z0-9_-]{1,128}$/),
  meetingUri: z.url({ protocol: /^https$/, hostname: /^meet\.google\.com$/ }).max(2048),
});

type Fetch = typeof fetch;

export interface GoogleMeetOptions {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  /** Injected by tests; defaults to the global fetch. */
  fetch?: Fetch;
  timeoutMs?: number;
  now?: () => number;
}

const CONFIG_HINT =
  'Ask the administrator to re-authorise Google Meet (GOOGLE_MEET_REFRESH_TOKEN), or paste a meeting link instead.';

async function call(
  fetchImpl: Fetch,
  url: string,
  init: RequestInit,
  timeoutMs: number,
  label: string,
): Promise<Response> {
  try {
    return await withTimeout(fetchImpl(url, init), timeoutMs, label);
  } catch {
    // Timeout or network failure. For meeting creation the space MAY exist; the caller records
    // the failure and only an explicit, claimed retry creates another.
    throw new MeetingProviderError(
      'UNAVAILABLE',
      'Google did not respond in time. Try again shortly.',
    );
  }
}

async function errorReason(response: Response): Promise<string | null> {
  try {
    const body = (await response.json()) as {
      error?: string | { status?: string; details?: { reason?: string }[] };
    };
    if (typeof body.error === 'string') return body.error;
    return body.error?.details?.find((d) => d.reason)?.reason ?? body.error?.status ?? null;
  } catch {
    return null;
  }
}

function fromStatus(status: number, reason: string | null): MeetingProviderError {
  if (status === 401 || reason === 'invalid_grant' || reason === 'invalid_client') {
    return new MeetingProviderError(
      'AUTHORIZATION',
      `Google rejected the academy's Google Meet authorisation (it may have expired or been revoked). ${CONFIG_HINT}`,
      status,
    );
  }
  if (status === 403) {
    const detail =
      reason === 'SERVICE_DISABLED'
        ? 'The Google Meet REST API is not enabled in the Google Cloud project.'
        : reason === 'ACCESS_TOKEN_SCOPE_INSUFFICIENT'
          ? 'The Google authorisation does not include the Meet scope.'
          : 'The Google account is not allowed to create meetings through the API.';
    return new MeetingProviderError('PERMISSION', `${detail} ${CONFIG_HINT}`, status);
  }
  if (status === 429) {
    return new MeetingProviderError(
      'RATE_LIMITED',
      'Google Meet is rate-limiting requests. Try again in a minute.',
      status,
    );
  }
  if (status >= 500) {
    return new MeetingProviderError(
      'UNAVAILABLE',
      'Google Meet is temporarily unavailable. Try again shortly.',
      status,
    );
  }
  return new MeetingProviderError(
    'INVALID_RESPONSE',
    `Google Meet refused the request (HTTP ${status}).`,
    status,
  );
}

export function createGoogleMeetProvider(options: GoogleMeetOptions): MeetingProvider {
  const clientId = options.clientId?.trim();
  const clientSecret = options.clientSecret?.trim();
  const refreshToken = options.refreshToken?.trim();
  const configured = Boolean(clientId && clientSecret && refreshToken);
  const fetchImpl = options.fetch ?? fetch;
  const timeoutMs = options.timeoutMs ?? GOOGLE_API_TIMEOUT_MS;
  const now = options.now ?? Date.now;
  let cached: { token: string; expiresAt: number } | null = null;

  async function accessToken(): Promise<string> {
    if (cached && cached.expiresAt - TOKEN_SKEW_MS > now()) return cached.token;
    const response = await call(
      fetchImpl,
      TOKEN_URL,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: clientId!,
          client_secret: clientSecret!,
          refresh_token: refreshToken!,
        }).toString(),
      },
      timeoutMs,
      'Google token request',
    );
    if (!response.ok) throw fromStatus(response.status, await errorReason(response));
    const parsed = tokenResponseSchema.safeParse(await response.json().catch(() => null));
    if (!parsed.success) {
      throw new MeetingProviderError(
        'INVALID_RESPONSE',
        'Google returned an unexpected token response.',
      );
    }
    if (
      parsed.data.scope !== undefined &&
      !parsed.data.scope.split(' ').includes(GOOGLE_MEET_SCOPE)
    ) {
      throw new MeetingProviderError(
        'PERMISSION',
        `The Google authorisation does not include the Meet scope. ${CONFIG_HINT}`,
      );
    }
    cached = { token: parsed.data.access_token, expiresAt: now() + parsed.data.expires_in * 1000 };
    return cached.token;
  }

  async function createSpace(token: string): Promise<Response> {
    return call(
      fetchImpl,
      SPACES_URL,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        // Empty space: access and moderation follow the owning account's Meet defaults.
        body: '{}',
      },
      timeoutMs,
      'Google Meet create space',
    );
  }

  return {
    id: 'google_meet',
    configured,
    async createMeeting(): Promise<CreatedMeeting> {
      if (!configured) {
        throw new MeetingProviderError(
          'NOT_CONFIGURED',
          'Automatic Google Meet links are not set up on this server. Paste a meeting link instead, or ask the administrator to configure Google Meet.',
        );
      }
      let response = await createSpace(await accessToken());
      if (response.status === 401) {
        // The cached token was revoked early. A 401 means nothing was created: one safe retry.
        cached = null;
        response = await createSpace(await accessToken());
      }
      if (!response.ok) throw fromStatus(response.status, await errorReason(response));
      const parsed = spaceResponseSchema.safeParse(await response.json().catch(() => null));
      if (!parsed.success) {
        throw new MeetingProviderError(
          'INVALID_RESPONSE',
          'Google Meet returned an unexpected response; no link was saved.',
        );
      }
      return { meetingId: parsed.data.name, joinUrl: parsed.data.meetingUri };
    },
  };
}

let provider: MeetingProvider = createGoogleMeetProvider({
  clientId: env.GOOGLE_MEET_CLIENT_ID,
  clientSecret: env.GOOGLE_MEET_CLIENT_SECRET,
  refreshToken: env.GOOGLE_MEET_REFRESH_TOKEN,
});

export function googleMeetProvider(): MeetingProvider {
  return provider;
}

/** Replaces the provider (tests install a fake HTTP client; never a fake success in production). */
export function setGoogleMeetProviderForTests(next: MeetingProvider): MeetingProvider {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('setGoogleMeetProviderForTests is only available in tests');
  }
  const previous = provider;
  provider = next;
  return previous;
}
