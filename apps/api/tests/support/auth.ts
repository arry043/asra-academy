import type { AuthSessionData, UserRole } from '@asra/types';
import { prisma } from '../../src/database/prisma.js';
import { seedAccessControl } from '../../src/database/seed/access-control.seed.js';
import { memoryTransport } from '../../src/email/email.service.js';
import { resetRateLimits } from '../../src/middleware/rate-limit.js';
import { provisionUser } from '../../src/services/user-provisioning.service.js';
import { cleanDomainTables, uniqueSuffix } from './fixtures.js';
import type { TestClient } from './http.js';

export const PASSWORD = 'correct horse battery staple';

/**
 * Fresh state for an auth test: no users/sessions/tokens, the canonical RBAC grants, empty
 * outbox, no limits. Grants are rebuilt from the seed definitions (not just topped up — the seed
 * is additive), so a permission granted at runtime by one test cannot leak into the next suite.
 */
export async function resetAuthState(): Promise<void> {
  await cleanDomainTables();
  await prisma.rolePermission.deleteMany();
  await seedAccessControl(prisma);
  outbox().length = 0;
  await resetRateLimits();
}

export function outbox() {
  if (!memoryTransport) throw new Error('Tests must run with EMAIL_TRANSPORT=memory');
  return memoryTransport.outbox;
}

/** Extracts the one-time token from the most recent email of `template` sent to `email`. */
export function tokenFromEmail(
  email: string,
  template: 'email-verification' | 'password-reset',
): string {
  const message = [...outbox()].reverse().find((m) => m.to === email && m.template === template);
  const token = message && /#token=([A-Za-z0-9_-]{43})/.exec(message.text)?.[1];
  if (!token) throw new Error(`No ${template} email with a token for ${email}`);
  return token;
}

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${uniqueSuffix()}@example.test`;
}

/** Registers via the API and verifies via the emailed link. */
export async function registerVerifiedStudent(client: TestClient, email = uniqueEmail('student')) {
  await client.request('POST', '/auth/register', {
    body: { fullName: 'Test Student', email, password: PASSWORD },
  });
  const token = tokenFromEmail(email, 'email-verification');
  await client.request('POST', '/auth/verify-email', { body: { token } });
  return email;
}

export async function provision(role: UserRole, email = uniqueEmail(role.toLowerCase())) {
  return provisionUser({ email, fullName: `Test ${role}`, password: PASSWORD, role });
}

export async function login(client: TestClient, email: string, password = PASSWORD) {
  const response = await client.request<AuthSessionData>('POST', '/auth/login', {
    body: { email, password },
  });
  if (response.status !== 200) {
    throw new Error(`Login failed (${response.status}): ${response.text}`);
  }
  return response.body.data;
}
