import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { after, before, beforeEach, describe, it } from 'node:test';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { disconnectPrisma } from '../src/database/prisma.js';
import { setEmailTransport } from '../src/email/email.service.js';
import { LOG_REDACTION } from '../src/lib/logger.js';
import { disconnectRedis } from '../src/lib/redis.js';
import {
  login,
  outbox,
  PASSWORD,
  registerVerifiedStudent,
  resetAuthState,
  uniqueEmail,
} from './support/auth.js';
import { startServer, TestClient, WEB_ORIGIN } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;

before(async () => ({ baseUrl, close } = await startServer(createApp())));
after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(() => resetAuthState());

describe('CORS', () => {
  const preflight = (origin: string) =>
    fetch(`${baseUrl}/api/v1/auth/login`, {
      method: 'OPTIONS',
      headers: {
        origin,
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });

  it('allows the configured web origin with credentials', async () => {
    const response = await preflight(WEB_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-origin'), WEB_ORIGIN);
    assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  });

  it('never reflects an unknown origin or a wildcard', async () => {
    const response = await preflight('https://evil.example');
    assert.equal(response.headers.get('access-control-allow-origin'), null);
    const simple = await fetch(`${baseUrl}/api/v1/health`, {
      headers: { origin: 'https://evil.example' },
    });
    assert.equal(simple.headers.get('access-control-allow-origin'), null);
  });
});

describe('CSRF protection on cookie-based endpoints', () => {
  it('rejects refresh/logout from an untrusted Origin even with a valid cookie', async () => {
    const client = new TestClient(baseUrl);
    await login(client, await registerVerifiedStudent(client));
    for (const path of ['/auth/refresh', '/auth/logout']) {
      const response = await client.request('POST', path, { origin: 'https://evil.example' });
      assert.equal(response.status, 403, path);
    }
    // Cross-site browser request without Origin.
    const noOrigin = await client.request('POST', '/auth/refresh', {
      origin: null,
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    assert.equal(noOrigin.status, 403);
    // The session is intact: a legitimate same-site refresh still works.
    assert.equal((await client.request('POST', '/auth/refresh')).status, 200);
  });
});

describe('Helmet headers', () => {
  it('sets defensive headers and hides the framework', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.ok(response.headers.get('strict-transport-security'));
    assert.ok(response.headers.get('content-security-policy'));
    assert.equal(response.headers.get('x-powered-by'), null);
  });
});

describe('secrets never leave the server', () => {
  it('login/refresh/me responses contain no password hash, refresh token or token hashes', async () => {
    const client = new TestClient(baseUrl);
    const email = await registerVerifiedStudent(client);
    const loginResponse = await client.request('POST', '/auth/login', {
      body: { email, password: PASSWORD },
    });
    const refresh = await client.request<{ accessToken: string }>('POST', '/auth/refresh');
    const me = await client.request('GET', '/auth/me', { token: refresh.body.data.accessToken });
    for (const response of [loginResponse, refresh, me]) {
      assert.doesNotMatch(response.text, /argon2|passwordHash|tokenHash|asra_refresh/);
      assert.ok(!response.text.includes(client.refreshCookie ?? '<none>'));
      assert.ok(!response.text.includes(PASSWORD));
    }
  });

  it('log redaction removes passwords, tokens and auth headers', () => {
    let output = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const log = pino({ redact: LOG_REDACTION }, sink);
    log.info(
      {
        password: 'p@ss-secret-1',
        body: { password: 'p@ss-secret-2', token: 'tok-secret-3', refreshToken: 'rt-secret-4' },
        accessToken: 'at-secret-5',
        req: {
          headers: { authorization: 'Bearer jwt-secret-6', cookie: 'asra_refresh=c-secret-7' },
        },
      },
      'request',
    );
    for (const secret of [
      'p@ss-secret-1',
      'p@ss-secret-2',
      'tok-secret-3',
      'rt-secret-4',
      'at-secret-5',
      'jwt-secret-6',
      'c-secret-7',
    ]) {
      assert.ok(!output.includes(secret), `${secret} leaked into logs`);
    }
    assert.match(output, /\[REDACTED\]/);
  });
});

describe('email delivery failures', () => {
  it('a failing provider does not leak into responses and the flow stays generic', async () => {
    const email = await registerVerifiedStudent(new TestClient(baseUrl));
    const sent = outbox().length;
    const previous = setEmailTransport({
      name: 'failing',
      send: () => Promise.reject(new Error('provider down')),
    });
    try {
      const response = await new TestClient(baseUrl).request('POST', '/auth/forgot-password', {
        body: { email },
      });
      assert.equal(response.status, 202);
      const register = await new TestClient(baseUrl).request('POST', '/auth/register', {
        body: { fullName: 'New Person', email: uniqueEmail('new'), password: PASSWORD },
      });
      assert.equal(register.status, 202);
      assert.equal(outbox().length, sent, 'nothing was reported as sent');
    } finally {
      setEmailTransport(previous);
    }
  });
});

describe('rate limiting', () => {
  it('registration is limited per IP with 429 and the standard envelope', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      const response = await new TestClient(baseUrl).request('POST', '/auth/register', {
        body: { fullName: 'Burst User', email: uniqueEmail('burst'), password: PASSWORD },
      });
      statuses.push(response.status);
      if (response.status === 429) {
        assert.equal((response.body.error as { code: string }).code, 'RATE_LIMITED');
      }
    }
    assert.deepEqual(statuses, [202, 202, 202, 202, 202, 429]);
  });

  it('forgot-password is limited per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push(
        (
          await new TestClient(baseUrl).request('POST', '/auth/forgot-password', {
            body: { email: uniqueEmail() },
          })
        ).status,
      );
    }
    assert.equal(statuses[5], 429);
  });

  // PHASE 15 (QA-DEF-03): every page load refreshes the session, and a 429 signs the user out.
  // A per-IP budget shared by a school network (or mobile CGNAT) must not log students out.
  it('refresh never throttles valid sessions or cookie-less visitors behind one IP', async () => {
    const student = new TestClient(baseUrl);
    await login(student, await registerVerifiedStudent(student));
    for (let i = 0; i < 70; i += 1) {
      const anonymous = await new TestClient(baseUrl).request('POST', '/auth/refresh');
      assert.equal(anonymous.status, 401, `anonymous refresh #${i + 1}`);
    }
    for (let i = 0; i < 70; i += 1) {
      const refreshed = await student.request('POST', '/auth/refresh');
      assert.equal(refreshed.status, 200, `valid refresh #${i + 1}`);
    }
  });

  it('refresh still limits invalid refresh tokens per IP', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 61; i += 1) {
      const guesser = new TestClient(baseUrl);
      guesser.cookies.set('asra_refresh', `guess${String(i).padStart(38, '0')}`);
      statuses.push((await guesser.request('POST', '/auth/refresh')).status);
    }
    assert.ok(statuses.slice(0, 60).every((status) => status === 401));
    assert.equal(statuses[60], 429);
  });
});
