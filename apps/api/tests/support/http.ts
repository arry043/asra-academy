import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Express } from 'express';

export const WEB_ORIGIN = 'http://localhost:3000';

export async function startServer(
  app: Express,
): Promise<{ baseUrl: string; close: () => Promise<void> }> {
  const server: Server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

export interface TestResponse<T = unknown> {
  status: number;
  body: { success: boolean; message: string; data: T; error?: { code: string; details?: unknown } };
  text: string;
  headers: Headers;
}

/**
 * Minimal browser-like client: remembers cookies set by the API (like a browser cookie jar
 * scoped to one site) and sends the web app's Origin by default.
 */
export class TestClient {
  readonly cookies = new Map<string, string>();

  constructor(private readonly baseUrl: string) {}

  async request<T = unknown>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      token?: string;
      origin?: string | null;
      headers?: Record<string, string>;
      withCookies?: boolean;
    } = {},
  ): Promise<TestResponse<T>> {
    const headers: Record<string, string> = { ...options.headers };
    if (options.body !== undefined) headers['content-type'] = 'application/json';
    if (options.token) headers.authorization = `Bearer ${options.token}`;
    const origin = options.origin === undefined ? WEB_ORIGIN : options.origin;
    if (origin) headers.origin = origin;
    if (options.withCookies !== false && this.cookies.size > 0) {
      headers.cookie = [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; ');
    }

    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ''] = cookie.split(';');
      const index = pair.indexOf('=');
      const name = pair.slice(0, index);
      const value = decodeURIComponent(pair.slice(index + 1));
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(cookie)) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }

    const text = await response.text();
    return {
      status: response.status,
      body: text ? (JSON.parse(text) as TestResponse<T>['body']) : ({} as TestResponse<T>['body']),
      text,
      headers: response.headers,
    };
  }

  get refreshCookie(): string | undefined {
    return this.cookies.get('asra_refresh');
  }
}
