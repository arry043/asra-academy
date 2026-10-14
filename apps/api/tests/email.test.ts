import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { describe, it } from 'node:test';
import { pino } from 'pino';
import { EmailDeliveryError, emailService, setEmailTransport } from '../src/email/email.service.js';
import {
  createResendTransport,
  ResendDeliveryError,
  type ResendClient,
} from '../src/email/transports.js';
import { LOG_REDACTION } from '../src/lib/logger.js';

const API_KEY = 're_test_key_never_printed_456';
const RECIPIENT = 'student@example.com';
const message = {
  from: 'ASRA Academy <no-reply@example.com>',
  to: RECIPIENT,
  subject: 'Subject',
  text: 'Body with a link',
  template: 'password-reset' as const,
};

type SendResult = Awaited<ReturnType<ResendClient['emails']['send']>>;

/** Fake Resend client: records payloads and answers with `result` (no network). */
function fakeClient(result: SendResult | (() => Promise<SendResult>)) {
  const calls: unknown[] = [];
  const client: ResendClient = {
    emails: {
      send: (payload) => {
        calls.push(payload);
        return typeof result === 'function' ? result() : Promise.resolve(result);
      },
    },
  };
  return { client, calls };
}

const providerError = (name: string, statusCode: number | null): SendResult => ({
  data: null,
  // Resend's free-text messages can echo the recipient; the transport must not propagate them.
  error: { name, statusCode, message: `Invalid \`to\` field: ${RECIPIENT}` },
});

describe('Resend transport', () => {
  it('submits exactly from/to/subject/text and resolves when Resend accepts the message', async () => {
    const { client, calls } = fakeClient({ data: { id: 'email_123' }, error: null });
    const transport = createResendTransport({ apiKey: API_KEY, client });
    assert.equal(transport.name, 'resend');
    await transport.send(message);
    assert.deepEqual(calls, [
      {
        from: 'ASRA Academy <no-reply@example.com>',
        to: RECIPIENT,
        subject: 'Subject',
        text: 'Body with a link',
      },
    ]);
  });

  it('throws when Resend reports an API error (e.g. invalid key or sender)', async () => {
    for (const [code, status] of [
      ['invalid_api_key', 403],
      ['invalid_from_address', 403],
      ['validation_error', 422],
      ['rate_limit_exceeded', 429],
    ] as const) {
      const { client } = fakeClient(providerError(code, status));
      await assert.rejects(
        createResendTransport({ apiKey: API_KEY, client }).send(message),
        (error: unknown) => {
          assert.ok(error instanceof ResendDeliveryError);
          assert.equal(error.code, code);
          assert.equal(error.statusCode, status);
          assert.ok(!error.message.includes(RECIPIENT), 'no recipient address in the error');
          assert.ok(!error.message.includes(API_KEY), 'no API key in the error');
          return true;
        },
      );
    }
  });

  it('throws on network failures, which the SDK reports without a status code', async () => {
    const { client } = fakeClient(providerError('application_error', null));
    await assert.rejects(
      createResendTransport({ apiKey: API_KEY, client }).send(message),
      ResendDeliveryError,
    );
  });

  it('throws when the client itself rejects or the request hangs past the timeout', async () => {
    const rejecting = fakeClient(() => Promise.reject(new Error('socket hang up')));
    await assert.rejects(
      createResendTransport({ apiKey: API_KEY, client: rejecting.client }).send(message),
      /socket hang up/,
    );
    const hanging = fakeClient(() => new Promise<SendResult>(() => {}));
    await assert.rejects(
      createResendTransport({ apiKey: API_KEY, client: hanging.client, timeoutMs: 20 }).send(
        message,
      ),
      /timed out/,
    );
  });

  it('builds the real SDK client from the configured key without any network call', () => {
    assert.equal(createResendTransport({ apiKey: API_KEY }).name, 'resend');
  });
});

describe('email service with the Resend transport', () => {
  it('reports a provider rejection as EmailDeliveryError without the token or address', async () => {
    const token = 'one-time-token-never-printed';
    const { client } = fakeClient(providerError('validation_error', 422));
    const previous = setEmailTransport(createResendTransport({ apiKey: API_KEY, client }));
    try {
      await assert.rejects(
        emailService.sendPasswordReset(RECIPIENT, 'Student', token),
        (error: unknown) => {
          assert.ok(error instanceof EmailDeliveryError);
          assert.ok(error.cause instanceof ResendDeliveryError);
          for (const text of [error.message, (error.cause as Error).message]) {
            assert.ok(
              !text.includes(token) && !text.includes(RECIPIENT) && !text.includes(API_KEY),
            );
          }
          return true;
        },
      );
    } finally {
      setEmailTransport(previous);
    }
  });
});

describe('log redaction of provider credentials', () => {
  it('removes EMAIL_API_KEY and apiKey fields', () => {
    let output = '';
    const sink = new Writable({
      write(chunk: Buffer, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    pino({ redact: LOG_REDACTION }, sink).info(
      { apiKey: API_KEY, config: { EMAIL_API_KEY: API_KEY } },
      'config',
    );
    assert.ok(!output.includes(API_KEY));
    assert.match(output, /\[REDACTED\]/);
  });
});
