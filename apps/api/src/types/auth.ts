import type { AuthUser } from '@asra/types';

/**
 * The authenticated principal attached to `req.auth` by `authenticate`. Built from the
 * database on every request (current roles, permissions and account status), not from JWT
 * claims, so revoked roles take effect immediately.
 */
export interface AuthContext {
  userId: string;
  sessionId: string;
  user: AuthUser;
  roles: ReadonlySet<string>;
  permissions: ReadonlySet<string>;
}
