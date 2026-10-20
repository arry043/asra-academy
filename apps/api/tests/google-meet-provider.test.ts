/**
 * PHASE 11 — Google Meet adapter (unit; no network). A fake `fetch` stands in for Google's token
 * endpoint and the Meet REST API, so these tests verify request shape, error mapping, token
 * caching and that no secret ever appears in an error.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGoogleMeetProvider,
  GOOGLE_MEET_SCOPE,
} from '../src/modules/live-classes/providers/google-meet.provider.js';
import { MeetingProviderError } from '../src/modules/live-classes/providers/meeting-provider.js';

const CREDENTIALS = {
  clientId: 'client-id-123.apps.googleusercontent.com',
  clientSecret: 'super-secret-client-value',
  refreshToken: '1//refresh-token-secret-value',
};

type Call = { url: string; init: RequestInit };

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

const tokenOk = (scope = GOOGLE_MEET_SCOPE) =>
  json(200, { access_token: 'ya29.access', expires_in: 3599, scope, token_type: 'Bearer' });
const spaceOk = (id = 'jQCFfuBOdN5z') =>
  json(200, {
    name: `spaces/${id}`,
    meetingUri: 'https://meet.google.com/abc-mnop-xyz',
    meetingCode: 'abc-mnop-xyz',
  });

/** A fake fetch answering from a queue, per URL host. */
function fakeFetch(responses: {
  token?: (() => Response)[];
  meet?: (() => Response | Promise<Response>)[];
}) {
  const calls: Call[] = [];
  const token = [...(responses.token ?? [])];
  const meet = [...(responses.meet ?? [])];
  const impl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init: init ?? {} });
    const next = url.startsWith('https://oauth2.googleapis.com') ? token.shift() : meet.shift();
    if (!next) throw new Error(`Unexpected request to ${url}`);
    return next();
  }) as typeof fetch;
  return { impl, calls };
}

async function rejection(promise: Promise<unknown>): Promise<MeetingProviderError> {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof MeetingProviderError, `expected MeetingProviderError, got ${error}`);
    for (const secret of Object.values(CREDENTIALS)) {
      assert.ok(!error.message.includes(secret), 'error message must not contain credentials');
    }
    return error;
  }
  assert.fail('expected the call to fail');
}

describe('Google Meet provider', () => {
  it('is not configured without all credentials and never calls Google', async () => {
    const { impl, calls } = fakeFetch({});
    const provider = createGoogleMeetProvider({ ...CREDENTIALS, refreshToken: '', fetch: impl });
    assert.equal(provider.configured, false);
    const error = await rejection(provider.createMeeting());
    assert.equal(error.kind, 'NOT_CONFIGURED');
    assert.equal(calls.length, 0);
  });

  it('exchanges the refresh token, creates a space and returns its link and id', async () => {
    const { impl, calls } = fakeFetch({ token: [tokenOk], meet: [spaceOk] });
    const provider = createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl });
    assert.equal(provider.configured, true);
    const meeting = await provider.createMeeting();
    assert.deepEqual(meeting, {
      meetingId: 'spaces/jQCFfuBOdN5z',
      joinUrl: 'https://meet.google.com/abc-mnop-xyz',
    });

    assert.equal(calls[0]!.url, 'https://oauth2.googleapis.com/token');
    const form = new URLSearchParams(String(calls[0]!.init.body));
    assert.equal(form.get('grant_type'), 'refresh_token');
    assert.equal(form.get('refresh_token'), CREDENTIALS.refreshToken);
    assert.equal(calls[1]!.url, 'https://meet.googleapis.com/v2/spaces');
    assert.equal(calls[1]!.init.method, 'POST');
    assert.equal(
      (calls[1]!.init.headers as Record<string, string>).Authorization,
      'Bearer ya29.access',
    );
  });

  it('caches the access token between meetings', async () => {
    const { impl, calls } = fakeFetch({ token: [tokenOk], meet: [spaceOk, () => spaceOk('b2')] });
    const provider = createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl });
    await provider.createMeeting();
    await provider.createMeeting();
    assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 1);
  });

  it('refreshes once when the cached token is rejected (nothing was created)', async () => {
    const now = { value: 0 };
    const { impl, calls } = fakeFetch({
      token: [tokenOk, tokenOk],
      meet: [
        spaceOk,
        () => json(401, { error: { status: 'UNAUTHENTICATED' } }),
        () => spaceOk('c3'),
      ],
    });
    const provider = createGoogleMeetProvider({
      ...CREDENTIALS,
      fetch: impl,
      now: () => now.value,
    });
    await provider.createMeeting();
    const second = await provider.createMeeting();
    assert.equal(second.meetingId, 'spaces/c3');
    assert.equal(calls.filter((c) => c.url.includes('oauth2')).length, 2);
  });

  it('maps an expired or revoked grant to an AUTHORIZATION error', async () => {
    const { impl } = fakeFetch({ token: [() => json(400, { error: 'invalid_grant' })] });
    const error = await rejection(
      createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl }).createMeeting(),
    );
    assert.equal(error.kind, 'AUTHORIZATION');
    assert.match(error.message, /re-authorise/);
  });

  it('refuses a grant that lacks the Meet scope', async () => {
    const { impl, calls } = fakeFetch({ token: [() => tokenOk('openid email')] });
    const error = await rejection(
      createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl }).createMeeting(),
    );
    assert.equal(error.kind, 'PERMISSION');
    assert.equal(calls.length, 1, 'no meeting request without the scope');
  });

  it('maps a disabled API, rate limiting and outages to distinct errors', async () => {
    const cases = [
      [
        json(403, {
          error: { status: 'PERMISSION_DENIED', details: [{ reason: 'SERVICE_DISABLED' }] },
        }),
        'PERMISSION',
        /not enabled/,
      ],
      [json(429, { error: { status: 'RESOURCE_EXHAUSTED' } }), 'RATE_LIMITED', /rate-limiting/],
      [json(503, { error: { status: 'UNAVAILABLE' } }), 'UNAVAILABLE', /temporarily unavailable/],
    ] as const;
    for (const [response, kind, message] of cases) {
      const { impl } = fakeFetch({ token: [tokenOk], meet: [() => response] });
      const error = await rejection(
        createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl }).createMeeting(),
      );
      assert.equal(error.kind, kind);
      assert.match(error.message, message);
    }
  });

  it('treats timeouts and network failures as UNAVAILABLE', async () => {
    const hang = () => new Promise<Response>(() => {});
    const { impl } = fakeFetch({ token: [tokenOk], meet: [hang] });
    const error = await rejection(
      createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl, timeoutMs: 20 }).createMeeting(),
    );
    assert.equal(error.kind, 'UNAVAILABLE');
  });

  it('never accepts a response that is not a Google Meet link', async () => {
    for (const body of [
      { name: 'spaces/ok', meetingUri: 'https://evil.example.com/abc' },
      { name: 'not-a-space', meetingUri: 'https://meet.google.com/abc-mnop-xyz' },
      { name: 'spaces/ok', meetingUri: 'http://meet.google.com/abc-mnop-xyz' },
      {},
    ]) {
      const { impl } = fakeFetch({ token: [tokenOk], meet: [() => json(200, body)] });
      const error = await rejection(
        createGoogleMeetProvider({ ...CREDENTIALS, fetch: impl }).createMeeting(),
      );
      assert.equal(error.kind, 'INVALID_RESPONSE');
    }
  });
});
