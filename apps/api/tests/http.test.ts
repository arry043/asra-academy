import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { after, before, describe, it } from 'node:test';
import type { Server } from 'node:http';
import express, { type Express } from 'express';
import { z } from 'zod';
import { createApp } from '../src/app.js';
import { disconnectPrisma, prisma } from '../src/database/prisma.js';
import { disconnectRedis } from '../src/lib/redis.js';
import { errorHandler } from '../src/middleware/error-handler.js';
import { requestLogger } from '../src/middleware/request-logger.js';
import { validateRequest } from '../src/middleware/validate-request.js';
import { healthService } from '../src/services/health.service.js';
import { sendSuccess } from '../src/utils/api-response.js';
import { idParamsSchema, listQuerySchema } from '../src/validators/common.validators.js';
import { uniqueSuffix } from './support/fixtures.js';

async function listen(app: Express): Promise<{ server: Server; baseUrl: string }> {
  const server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return { server, baseUrl: `http://127.0.0.1:${port}` };
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((resolve) => server.close(() => resolve()));
}

// The readiness route pings Redis, which makes ioredis (lazyConnect) open a connection.
after(() => Promise.all([disconnectPrisma(), disconnectRedis()]));

describe('HTTP: application routes', () => {
  let server: Server;
  let baseUrl: string;

  before(async () => ({ server, baseUrl } = await listen(createApp())));
  after(() => close(server));

  it('GET /api/v1/health → 200 liveness envelope with X-Request-Id', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`);
    assert.equal(response.status, 200);
    assert.ok(response.headers.get('x-request-id'));
    assert.deepEqual(await response.json(), {
      success: true,
      message: 'ASRA Academy API is running',
      data: { environment: 'test' },
    });
  });

  it('GET /api/v1/health/ready reports database status without leaking details', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health/ready`);
    const body = (await response.json()) as Record<string, unknown>;
    const data = (body.data ?? (body.error as { details?: unknown }).details) as Record<
      string,
      string
    >;
    // Redis may or may not be running during tests; the database must be up.
    assert.equal(data.database, 'up');
    assert.equal(response.status, data.redis === 'up' ? 200 : 503);
    assert.doesNotMatch(JSON.stringify(body), /postgres(ql)?:\/\//);
  });

  it('unknown routes → 404 NOT_FOUND envelope', async () => {
    const response = await fetch(`${baseUrl}/api/v1/does-not-exist`);
    assert.equal(response.status, 404);
    const body = (await response.json()) as { success: boolean; error: { code: string } };
    assert.equal(body.success, false);
    assert.equal(body.error.code, 'NOT_FOUND');
  });

  it('malformed JSON → 400 BAD_REQUEST envelope', async () => {
    const response = await fetch(`${baseUrl}/api/v1/health`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"broken": ',
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'BAD_REQUEST');
  });
});

describe('readiness service', () => {
  it('reports the database as down when the probe fails', async () => {
    const data = await healthService.getReadiness({
      database: () => Promise.reject(new Error('connection refused')),
      redis: () => Promise.resolve('PONG'),
    });
    assert.equal(data.database, 'down');
    assert.equal(data.redis, 'up');
  });

  it('reports the database as up when the probe succeeds', async () => {
    const data = await healthService.getReadiness({
      database: () => Promise.resolve(),
      redis: () => Promise.reject(new Error('down')),
    });
    assert.equal(data.database, 'up');
    assert.equal(data.redis, 'down');
  });
});

/**
 * A throw-away router wired exactly like future business modules
 * (validateRequest → handler → repository/Prisma → central error handler). No production
 * endpoints are added in Phase 02.
 */
describe('HTTP: validation and error handling pipeline', () => {
  let server: Server;
  let baseUrl: string;
  const email = `pipeline-${uniqueSuffix()}@example.test`;

  before(async () => {
    const app = express();
    app.use(requestLogger);
    app.use(express.json());
    app.get(
      '/items/:id',
      validateRequest({ params: idParamsSchema, query: listQuerySchema }),
      (req, res) => {
        sendSuccess(res, { id: req.params.id, query: req.query });
      },
    );
    app.post(
      '/users',
      validateRequest({ body: z.object({ email: z.string(), fullName: z.string().min(1) }) }),
      async (req, res) => {
        const body = req.body as { email: string; fullName: string };
        const user = await prisma.user.create({ data: body });
        sendSuccess(res, { id: user.id }, 'Created', 201);
      },
    );
    app.use(errorHandler);
    ({ server, baseUrl } = await listen(app));
  });

  after(async () => {
    await close(server);
    await prisma.user.deleteMany({ where: { email } });
  });

  const post = (body: unknown) =>
    fetch(`${baseUrl}/users`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

  it('passes parsed, coerced values to the handler', async () => {
    const id = '7f1c1e9a-2b3c-4d5e-8f90-1234567890ab';
    const response = await fetch(`${baseUrl}/items/${id}?page=2`);
    assert.equal(response.status, 200);
    const body = (await response.json()) as { data: { id: string; query: unknown } };
    assert.deepEqual(body.data, { id, query: { page: 2, pageSize: 20 } });
  });

  it('invalid params → 422 VALIDATION_ERROR with issue details', async () => {
    const response = await fetch(`${baseUrl}/items/not-a-uuid`);
    assert.equal(response.status, 422);
    const body = (await response.json()) as {
      error: { code: string; details: { path: string[] }[] };
    };
    assert.equal(body.error.code, 'VALIDATION_ERROR');
    assert.deepEqual(body.error.details[0]?.path, ['id']);
  });

  it('missing required body fields → 422 VALIDATION_ERROR', async () => {
    const response = await post({ email });
    assert.equal(response.status, 422);
  });

  it('duplicate unique value → 409 CONFLICT without leaking SQL or constraint names', async () => {
    assert.equal((await post({ email, fullName: 'First' })).status, 201);
    const response = await post({ email, fullName: 'Second' });
    assert.equal(response.status, 409);
    const text = await response.text();
    assert.equal(JSON.parse(text).error.code, 'CONFLICT');
    assert.doesNotMatch(text, /users_email_key|INSERT|duplicate key/i);
  });

  it('CHECK violation → 422 without echoing the rejected row', async () => {
    const response = await post({
      email: `UPPER-${uniqueSuffix()}@Example.test`,
      fullName: 'Secret Name',
    });
    assert.equal(response.status, 422);
    const text = await response.text();
    assert.doesNotMatch(text, /Secret Name|users_email_normalized|Failing row/);
  });
});
