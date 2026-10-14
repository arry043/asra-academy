import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import type { AuthSessionData, AuthUser } from '@asra/types';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { setEmailTransport } from '../src/email/email.service.js';
import { createResendTransport } from '../src/email/transports.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { hashToken } from '../src/utils/crypto.js';
import {
  login,
  outbox,
  PASSWORD,
  provision,
  registerVerifiedStudent,
  resetAuthState,
  tokenFromEmail,
  uniqueEmail,
} from './support/auth.js';
import { startServer, TestClient } from './support/http.js';

let baseUrl: string;
let close: () => Promise<void>;
const client = () => new TestClient(baseUrl);

before(async () => ({ baseUrl, close } = await startServer(createApp())));
after(async () => {
  await close();
  await Promise.all([disconnectPrisma(), disconnectRedis()]);
});
beforeEach(() => resetAuthState());

/** Backdates a session/token so it is expired (keeping created_at < expires_at). */
const past = (hours: number) => new Date(Date.now() - hours * 60 * 60 * 1000);

/** Runs `action` while Resend rejects every message (fake client, no network). */
async function withRejectingResend<T>(action: () => Promise<T>): Promise<T> {
  const previous = setEmailTransport(
    createResendTransport({
      apiKey: 're_test_dummy',
      client: {
        emails: {
          send: async () => ({
            data: null,
            error: { name: 'application_error', statusCode: null, message: 'unreachable' },
          }),
        },
      },
    }),
  );
  try {
    return await action();
  } finally {
    setEmailTransport(previous);
  }
}

describe('registration', () => {
  it('creates an unverified STUDENT with a hashed password, profile and hashed token', async () => {
    const email = uniqueEmail('reg');
    const response = await client().request('POST', '/auth/register', {
      body: { fullName: '  Asha Khan ', email: ` ${email.toUpperCase()} `, password: PASSWORD },
    });
    assert.equal(response.status, 202);
    assert.equal(response.body.data, null);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email },
      include: { roles: { include: { role: true } }, studentProfile: true, oneTimeTokens: true },
    });
    assert.equal(user.fullName, 'Asha Khan');
    assert.equal(user.emailVerifiedAt, null);
    assert.deepEqual(
      user.roles.map((r) => r.role.key),
      ['STUDENT'],
    );
    assert.ok(user.studentProfile);
    assert.match(user.passwordHash ?? '', /^\$argon2id\$/);
    assert.ok(!user.passwordHash?.includes(PASSWORD));

    const token = tokenFromEmail(email, 'email-verification');
    assert.equal(user.oneTimeTokens.length, 1);
    assert.equal(user.oneTimeTokens[0]?.tokenHash, hashToken(token));
    assert.notEqual(user.oneTimeTokens[0]?.tokenHash, token);
  });

  it('rejects an invalid email and a too-short password with 422', async () => {
    const badEmail = await client().request('POST', '/auth/register', {
      body: { fullName: 'A B', email: 'not-an-email', password: PASSWORD },
    });
    assert.equal(badEmail.status, 422);
    const shortPassword = await client().request('POST', '/auth/register', {
      body: { fullName: 'A B', email: uniqueEmail(), password: 'short' },
    });
    assert.equal(shortPassword.status, 422);
    assert.equal(await prisma.user.count(), 0);
  });

  it('refuses privileged role assignment: unknown fields such as `role` are rejected', async () => {
    for (const extra of [
      { role: 'SUPER_ADMIN' },
      { roles: ['ADMIN'] },
      { roleId: 'x' },
      { status: 'ACTIVE' },
    ]) {
      const response = await client().request('POST', '/auth/register', {
        body: { fullName: 'Mallory', email: uniqueEmail('mallory'), password: PASSWORD, ...extra },
      });
      assert.equal(response.status, 422, JSON.stringify(extra));
    }
    assert.equal(await prisma.user.count(), 0);
  });

  it('answers a duplicate email exactly like a new one (no enumeration)', async () => {
    const email = await registerVerifiedStudent(client());
    const before = outbox().length;
    const fresh = await client().request('POST', '/auth/register', {
      body: { fullName: 'Someone', email: uniqueEmail('fresh'), password: PASSWORD },
    });
    const duplicate = await client().request('POST', '/auth/register', {
      body: { fullName: 'Someone Else', email, password: 'another long password' },
    });
    assert.equal(duplicate.status, fresh.status);
    assert.equal(duplicate.body.message, fresh.body.message);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
    // The real owner is told instead, out of band.
    assert.ok(
      outbox()
        .slice(before)
        .some((m) => m.to === email && m.template === 'account-exists'),
    );
  });
});

describe('login', () => {
  it('signs in a verified student: access token in body, refresh token only in HttpOnly cookie', async () => {
    const c = client();
    const email = await registerVerifiedStudent(c);
    const response = await c.request<AuthSessionData>('POST', '/auth/login', {
      body: { email, password: PASSWORD },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.tokenType, 'Bearer');
    assert.equal(response.body.data.expiresIn, 15 * 60);
    assert.deepEqual(response.body.data.user.roles, ['STUDENT']);
    assert.equal(response.headers.get('cache-control'), 'no-store');

    const setCookie = response.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /^asra_refresh=/);
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    assert.match(setCookie, /Path=\/api\/v1\/auth/);
    assert.ok(!response.text.includes(c.refreshCookie ?? '<none>'));

    // The stored session holds only the hash.
    const session = await prisma.authSession.findFirstOrThrow({ where: { user: { email } } });
    assert.equal(session.tokenHash, hashToken(c.refreshCookie ?? ''));
  });

  for (const role of ['FACULTY', 'ADMIN', 'SUPER_ADMIN'] as const) {
    it(`signs in a provisioned ${role}`, async () => {
      const user = await provision(role);
      const session = await login(client(), user.email);
      assert.deepEqual(session.user.roles, [role]);
    });
  }

  it('returns the same generic 401 for a wrong password and an unknown email', async () => {
    const email = await registerVerifiedStudent(client());
    const wrong = await client().request('POST', '/auth/login', {
      body: { email, password: 'wrong password here' },
    });
    const unknown = await client().request('POST', '/auth/login', {
      body: { email: uniqueEmail('ghost'), password: PASSWORD },
    });
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.equal(wrong.body.message, unknown.body.message);
    assert.equal(wrong.headers.get('set-cookie'), null);
  });

  it('rejects missing credentials with 422', async () => {
    assert.equal((await client().request('POST', '/auth/login', { body: {} })).status, 422);
    assert.equal(
      (await client().request('POST', '/auth/login', { body: { email: uniqueEmail() } })).status,
      422,
    );
  });

  it('blocks unverified accounts (403 EMAIL_NOT_VERIFIED) — verification is required to sign in', async () => {
    const email = uniqueEmail('unverified');
    await client().request('POST', '/auth/register', {
      body: { fullName: 'Not Yet', email, password: PASSWORD },
    });
    const response = await client().request('POST', '/auth/login', {
      body: { email, password: PASSWORD },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'EMAIL_NOT_VERIFIED');
  });

  it('blocks disabled accounts (403 ACCOUNT_DISABLED)', async () => {
    const user = await provision('ADMIN');
    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });
    const response = await client().request('POST', '/auth/login', {
      body: { email: user.email, password: PASSWORD },
    });
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'ACCOUNT_DISABLED');
  });

  it('rate-limits repeated failed attempts with 429', async () => {
    const email = await registerVerifiedStudent(client());
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await client().request('POST', '/auth/login', {
        body: { email, password: 'definitely wrong' },
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.equal(statuses[10], 429);
    // Even the right password is throttled now.
    const blocked = await client().request('POST', '/auth/login', {
      body: { email, password: PASSWORD },
    });
    assert.equal(blocked.status, 429);
    assert.equal(blocked.body.error?.code, 'RATE_LIMITED');
    assert.ok(blocked.headers.get('retry-after'));
  });
});

describe('refresh session', () => {
  it('rotates the refresh token and issues a new access token', async () => {
    const c = client();
    const email = await registerVerifiedStudent(c);
    const first = await login(c, email);
    const oldCookie = c.refreshCookie;

    const response = await c.request<AuthSessionData>('POST', '/auth/refresh');
    assert.equal(response.status, 200);
    assert.notEqual(c.refreshCookie, oldCookie);
    assert.notEqual(response.body.data.accessToken, first.accessToken);

    const me = await c.request<AuthUser>('GET', '/auth/me', {
      token: response.body.data.accessToken,
    });
    assert.equal(me.status, 200);
  });

  it('rejects a missing or unknown refresh token with 401', async () => {
    assert.equal((await client().request('POST', '/auth/refresh')).status, 401);
    const c = client();
    c.cookies.set('asra_refresh', 'x'.repeat(43));
    assert.equal((await c.request('POST', '/auth/refresh')).status, 401);
  });

  it('rejects an expired session', async () => {
    const c = client();
    await login(c, await registerVerifiedStudent(c));
    await prisma.authSession.updateMany({ data: { createdAt: past(48), expiresAt: past(1) } });
    const response = await c.request('POST', '/auth/refresh');
    assert.equal(response.status, 401);
    assert.equal(c.refreshCookie, undefined, 'cookie is cleared');
  });

  it('rejects a revoked session', async () => {
    const c = client();
    await login(c, await registerVerifiedStudent(c));
    await prisma.authSession.updateMany({
      data: { revokedAt: new Date(), revokedReason: 'LOGOUT' },
    });
    assert.equal((await c.request('POST', '/auth/refresh')).status, 401);
  });

  it('detects reuse of a rotated token and revokes the whole session', async () => {
    const legit = client();
    const session = await login(legit, await registerVerifiedStudent(legit));
    const stolen = legit.refreshCookie ?? '';

    assert.equal((await legit.request('POST', '/auth/refresh')).status, 200);

    const attacker = client();
    attacker.cookies.set('asra_refresh', stolen);
    assert.equal((await attacker.request('POST', '/auth/refresh')).status, 401);

    // The legitimate holder's newer token and access token are dead too.
    assert.equal((await legit.request('POST', '/auth/refresh')).status, 401);
    assert.equal(
      (await legit.request('GET', '/auth/me', { token: session.accessToken })).status,
      401,
    );
    const stored = await prisma.authSession.findFirstOrThrow();
    assert.equal(stored.revokedReason, 'TOKEN_REUSE');
  });

  it('concurrent refreshes with the same token: exactly one succeeds, no parallel sessions survive', async () => {
    const c = client();
    await login(c, await registerVerifiedStudent(c));
    const cookie = c.refreshCookie ?? '';

    const racers = Array.from({ length: 5 }, () => {
      const racer = client();
      racer.cookies.set('asra_refresh', cookie);
      return racer.request('POST', '/auth/refresh');
    });
    const statuses = (await Promise.all(racers)).map((r) => r.status).sort();
    assert.deepEqual(statuses, [200, 401, 401, 401, 401]);
    assert.equal(await prisma.authSession.count({ where: { revokedAt: null } }), 0);
  });

  it('refuses to refresh for an account disabled after login', async () => {
    const c = client();
    const user = await provision('FACULTY');
    await login(c, user.email);
    await prisma.user.update({ where: { id: user.id }, data: { status: 'INACTIVE' } });
    const response = await c.request('POST', '/auth/refresh');
    assert.equal(response.status, 403);
    assert.equal(response.body.error?.code, 'ACCOUNT_DISABLED');
  });
});

describe('logout', () => {
  it('revokes the session, clears the cookie and is idempotent', async () => {
    const c = client();
    const session = await login(c, await registerVerifiedStudent(c));
    const cookie = c.refreshCookie ?? '';

    const first = await c.request('POST', '/auth/logout');
    assert.equal(first.status, 200);
    assert.match(first.headers.get('set-cookie') ?? '', /asra_refresh=;/);
    const stored = await prisma.authSession.findFirstOrThrow();
    assert.equal(stored.revokedReason, 'LOGOUT');

    // Repeating (with or without the old cookie) still succeeds.
    assert.equal((await c.request('POST', '/auth/logout')).status, 200);
    const replay = client();
    replay.cookies.set('asra_refresh', cookie);
    assert.equal((await replay.request('POST', '/auth/logout')).status, 200);

    // The old refresh token and the access token no longer work.
    assert.equal((await replay.request('POST', '/auth/refresh')).status, 401);
    assert.equal((await c.request('GET', '/auth/me', { token: session.accessToken })).status, 401);
  });

  it('logout-all revokes every session of the user only', async () => {
    const email = await registerVerifiedStudent(client());
    const [a, b] = [client(), client()];
    const sessionA = await login(a, email);
    await login(b, email);
    const other = client();
    const otherSession = await login(other, await registerVerifiedStudent(other));

    const response = await a.request<{ revokedSessions: number }>('POST', '/auth/logout-all', {
      token: sessionA.accessToken,
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.revokedSessions, 2);
    assert.equal((await b.request('POST', '/auth/refresh')).status, 401);
    // Another user's session is untouched.
    assert.equal(
      (await other.request('GET', '/auth/me', { token: otherSession.accessToken })).status,
      200,
    );
  });
});

describe('password recovery', () => {
  it('answers identically for known and unknown emails', async () => {
    const email = await registerVerifiedStudent(client());
    const known = await client().request('POST', '/auth/forgot-password', { body: { email } });
    const unknown = await client().request('POST', '/auth/forgot-password', {
      body: { email: uniqueEmail('nobody') },
    });
    assert.equal(known.status, 202);
    assert.equal(unknown.status, 202);
    assert.equal(known.body.message, unknown.body.message);
    assert.equal(outbox().filter((m) => m.template === 'password-reset').length, 1);
  });

  it('stays generic when Resend rejects the reset email, and a retry delivers a working link', async () => {
    const email = await registerVerifiedStudent(client());
    const failed = await withRejectingResend(() =>
      client().request('POST', '/auth/forgot-password', { body: { email } }),
    );
    assert.equal(failed.status, 202);
    assert.equal(outbox().filter((m) => m.template === 'password-reset').length, 0);

    const retried = await client().request('POST', '/auth/forgot-password', { body: { email } });
    assert.equal(retried.body.message, failed.body.message);
    const reset = await client().request('POST', '/auth/reset-password', {
      body: { token: tokenFromEmail(email, 'password-reset'), password: 'a brand new password' },
    });
    assert.equal(reset.status, 200);
  });

  it('resets the password with a valid token, revokes all sessions, and the token is single-use', async () => {
    const c = client();
    const email = await registerVerifiedStudent(c);
    const oldSession = await login(c, email);
    await client().request('POST', '/auth/forgot-password', { body: { email } });
    const token = tokenFromEmail(email, 'password-reset');

    const stored = await prisma.oneTimeToken.findFirstOrThrow({
      where: { purpose: 'PASSWORD_RESET' },
    });
    assert.equal(stored.tokenHash, hashToken(token));

    const newPassword = 'a brand new passphrase';
    const reset = await client().request('POST', '/auth/reset-password', {
      body: { token, password: newPassword },
    });
    assert.equal(reset.status, 200);

    // Existing sessions are revoked.
    assert.equal((await c.request('POST', '/auth/refresh')).status, 401);
    assert.equal(
      (await c.request('GET', '/auth/me', { token: oldSession.accessToken })).status,
      401,
    );
    const revoked = await prisma.authSession.findFirstOrThrow();
    assert.equal(revoked.revokedReason, 'PASSWORD_RESET');

    // Old password fails, new password works.
    assert.equal(
      (await client().request('POST', '/auth/login', { body: { email, password: PASSWORD } }))
        .status,
      401,
    );
    await login(client(), email, newPassword);

    // Reuse is rejected.
    const again = await client().request('POST', '/auth/reset-password', {
      body: { token, password: 'yet another passphrase' },
    });
    assert.equal(again.status, 400);
  });

  it('rejects invalid, malformed and expired reset tokens', async () => {
    const email = await registerVerifiedStudent(client());
    await client().request('POST', '/auth/forgot-password', { body: { email } });
    const token = tokenFromEmail(email, 'password-reset');

    const malformed = await client().request('POST', '/auth/reset-password', {
      body: { token: 'abc', password: 'a brand new passphrase' },
    });
    assert.equal(malformed.status, 422);
    const unknown = await client().request('POST', '/auth/reset-password', {
      body: { token: 'A'.repeat(43), password: 'a brand new passphrase' },
    });
    assert.equal(unknown.status, 400);

    await prisma.oneTimeToken.updateMany({ data: { createdAt: past(2), expiresAt: past(1) } });
    const expired = await client().request('POST', '/auth/reset-password', {
      body: { token, password: 'a brand new passphrase' },
    });
    assert.equal(expired.status, 400);
  });

  it('concurrent resets with one token: exactly one succeeds', async () => {
    const email = await registerVerifiedStudent(client());
    await client().request('POST', '/auth/forgot-password', { body: { email } });
    const token = tokenFromEmail(email, 'password-reset');
    const statuses = (
      await Promise.all(
        ['first passphrase one', 'second passphrase two', 'third passphrase three'].map(
          (password) =>
            client().request('POST', '/auth/reset-password', { body: { token, password } }),
        ),
      )
    )
      .map((r) => r.status)
      .sort();
    assert.deepEqual(statuses, [200, 400, 400]);
  });
});

describe('email verification', () => {
  it('verifies with a valid token, then rejects its reuse', async () => {
    const email = uniqueEmail('verify');
    await client().request('POST', '/auth/register', {
      body: { fullName: 'Verify Me', email, password: PASSWORD },
    });
    const token = tokenFromEmail(email, 'email-verification');

    const ok = await client().request<{ status: string }>('POST', '/auth/verify-email', {
      body: { token },
    });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.data.status, 'verified');
    assert.ok((await prisma.user.findUniqueOrThrow({ where: { email } })).emailVerifiedAt);

    const reused = await client().request('POST', '/auth/verify-email', { body: { token } });
    assert.equal(reused.status, 400);
  });

  it('rejects an expired token', async () => {
    const email = uniqueEmail('late');
    await client().request('POST', '/auth/register', {
      body: { fullName: 'Too Late', email, password: PASSWORD },
    });
    const token = tokenFromEmail(email, 'email-verification');
    await prisma.oneTimeToken.updateMany({ data: { createdAt: past(48), expiresAt: past(1) } });
    assert.equal(
      (await client().request('POST', '/auth/verify-email', { body: { token } })).status,
      400,
    );
  });

  it('reports an already-verified account', async () => {
    const user = await provision('STUDENT'); // provisioned accounts are pre-verified
    // Issue a verification token directly to simulate a link still in the inbox.
    const { emailVerificationService } =
      await import('../src/services/email-verification.service.js');
    await emailVerificationService.issueAndSend(user);
    const token = tokenFromEmail(user.email, 'email-verification');
    const response = await client().request<{ status: string }>('POST', '/auth/verify-email', {
      body: { token },
    });
    assert.equal(response.status, 200);
    assert.equal(response.body.data.status, 'already-verified');
  });

  it('resend issues a new link (old one invalidated), stays generic, and is rate-limited', async () => {
    const email = uniqueEmail('resend');
    await client().request('POST', '/auth/register', {
      body: { fullName: 'Resend Me', email, password: PASSWORD },
    });
    const firstToken = tokenFromEmail(email, 'email-verification');

    const resent = await client().request('POST', '/auth/resend-verification', { body: { email } });
    const unknown = await client().request('POST', '/auth/resend-verification', {
      body: { email: uniqueEmail('ghost') },
    });
    assert.equal(resent.status, 202);
    assert.equal(unknown.status, 202);
    assert.equal(resent.body.message, unknown.body.message);

    const secondToken = tokenFromEmail(email, 'email-verification');
    assert.notEqual(secondToken, firstToken);
    assert.equal(
      (await client().request('POST', '/auth/verify-email', { body: { token: firstToken } }))
        .status,
      400,
    );

    // Limit is 3 per 15 minutes per IP: two used above, one more allowed, then 429.
    assert.equal(
      (await client().request('POST', '/auth/resend-verification', { body: { email } })).status,
      202,
    );
    const limited = await client().request('POST', '/auth/resend-verification', {
      body: { email },
    });
    assert.equal(limited.status, 429);
  });

  it('recovers from a rejected verification email via resend-verification', async () => {
    const email = uniqueEmail('undelivered');
    const register = await withRejectingResend(() =>
      client().request('POST', '/auth/register', {
        body: { fullName: 'Not Delivered', email, password: PASSWORD },
      }),
    );
    assert.equal(register.status, 202);
    assert.equal(await prisma.user.count({ where: { email } }), 1);
    assert.equal(outbox().filter((m) => m.to === email).length, 0);

    const resent = await client().request('POST', '/auth/resend-verification', { body: { email } });
    assert.equal(resent.status, 202);
    const verified = await client().request<{ status: string }>('POST', '/auth/verify-email', {
      body: { token: tokenFromEmail(email, 'email-verification') },
    });
    assert.equal(verified.status, 200);
    assert.equal(verified.body.data.status, 'verified');
  });
});
