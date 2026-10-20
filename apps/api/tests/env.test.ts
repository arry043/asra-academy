import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { z } from 'zod';
import { parseEnv } from '../src/config/env.js';

/** Smallest valid environment; each test adds the email settings it is about. */
const base = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/asra',
  JWT_SECRET: 'x'.repeat(40),
};

const RESEND_KEY = 're_test_key_never_printed_123';
const resend = {
  EMAIL_TRANSPORT: 'resend',
  EMAIL_API_KEY: RESEND_KEY,
  EMAIL_FROM: 'ASRA Academy <no-reply@example.com>',
};

function issuePaths(source: Record<string, string | undefined>): string[] {
  const result = parseEnv(source);
  assert.equal(result.success, false, 'expected the environment to be rejected');
  return result.error!.issues.map((issue) => issue.path.join('.'));
}

describe('email configuration', () => {
  it('defaults to console in development and memory in tests, with no API key needed', () => {
    const development = parseEnv({ ...base, NODE_ENV: 'development' });
    const test = parseEnv({ ...base, NODE_ENV: 'test' });
    assert.equal(development.data?.EMAIL_TRANSPORT, 'console');
    assert.equal(test.data?.EMAIL_TRANSPORT, 'memory');
  });

  it('accepts a complete Resend configuration with a bare or display-name sender', () => {
    for (const EMAIL_FROM of ['no-reply@example.com', 'ASRA Academy <no-reply@example.com>']) {
      const result = parseEnv({ ...base, ...resend, EMAIL_FROM });
      assert.equal(result.success, true, EMAIL_FROM);
      assert.equal(result.data?.EMAIL_TRANSPORT, 'resend');
    }
  });

  it('requires EMAIL_API_KEY when EMAIL_TRANSPORT=resend', () => {
    for (const EMAIL_API_KEY of [undefined, '', '   ']) {
      assert.deepEqual(issuePaths({ ...base, ...resend, EMAIL_API_KEY }), ['EMAIL_API_KEY']);
    }
  });

  it('requires a valid, non-localhost sender when EMAIL_TRANSPORT=resend', () => {
    for (const EMAIL_FROM of [
      undefined, // falls back to the development default on localhost
      'no-reply@localhost',
      'not-an-email',
      'ASRA Academy <not-an-email>',
      'ASRA <a@example.com> <b@example.com>',
    ]) {
      assert.deepEqual(issuePaths({ ...base, ...resend, EMAIL_FROM }), ['EMAIL_FROM'], EMAIL_FROM);
    }
  });

  it('rejects unsupported transports', () => {
    assert.deepEqual(issuePaths({ ...base, EMAIL_TRANSPORT: 'smtp' }), ['EMAIL_TRANSPORT']);
  });

  it('refuses to start in production without Resend (unset, console or memory)', () => {
    for (const EMAIL_TRANSPORT of [undefined, 'console', 'memory']) {
      assert.deepEqual(
        issuePaths({ ...base, NODE_ENV: 'production', EMAIL_TRANSPORT }),
        ['EMAIL_TRANSPORT'],
        String(EMAIL_TRANSPORT),
      );
    }
  });

  it('starts in production with a complete Resend configuration', () => {
    const result = parseEnv({ ...base, ...resend, NODE_ENV: 'production' });
    assert.equal(result.success, true);
    assert.equal(result.data?.AUTH_COOKIE_SECURE, true);
  });

  it('never echoes the API key in validation errors', () => {
    const result = parseEnv({
      ...base,
      ...resend,
      NODE_ENV: 'production',
      EMAIL_FROM: 'bad-sender',
      AUTH_COOKIE_SECURE: 'false',
    });
    assert.equal(result.success, false);
    const reported = z.prettifyError(result.error!) + JSON.stringify(result.error!.issues);
    assert.ok(!reported.includes(RESEND_KEY));
  });
});

describe('Google Meet configuration (PHASE 11)', () => {
  const google = {
    GOOGLE_MEET_CLIENT_ID: 'client.apps.googleusercontent.com',
    GOOGLE_MEET_CLIENT_SECRET: 'GOCSPX-never-printed',
    GOOGLE_MEET_REFRESH_TOKEN: '1//refresh-never-printed',
  };

  it('is optional: none set or all set', () => {
    assert.equal(parseEnv({ ...base }).success, true);
    assert.equal(parseEnv({ ...base, ...google }).success, true);
  });

  it('rejects a partial set, naming the missing variables but never the values', () => {
    const result = parseEnv({ ...base, ...google, GOOGLE_MEET_REFRESH_TOKEN: '' });
    assert.equal(result.success, false);
    assert.deepEqual(
      result.error!.issues.map((issue) => issue.path.join('.')),
      ['GOOGLE_MEET_REFRESH_TOKEN'],
    );
    const reported = z.prettifyError(result.error!) + JSON.stringify(result.error!.issues);
    assert.ok(!reported.includes(google.GOOGLE_MEET_CLIENT_SECRET));
    assert.ok(!reported.includes(google.GOOGLE_MEET_CLIENT_ID));
  });
});
