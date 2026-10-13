import type { PermissionKey, UserRole } from './roles.js';

/** Safe representation of the signed-in user. Never contains hashes or tokens. */
export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  emailVerified: boolean;
  /** Role keys currently assigned in the database (may include roles added after PHASE 03). */
  roles: (UserRole | (string & {}))[];
  /** Effective permission keys: the union of all the user's role grants. */
  permissions: (PermissionKey | (string & {}))[];
}

/**
 * Payload of `POST /auth/login` and `POST /auth/refresh`. The refresh token is NOT here: it is
 * only ever set as an HttpOnly cookie.
 */
export interface AuthSessionData {
  accessToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
  user: AuthUser;
}
