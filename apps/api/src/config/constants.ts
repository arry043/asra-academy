export const API_PREFIX = '/api/v1';

export const APP_NAME = 'ASRA Academy API';

/** Maximum time to wait for in-flight requests and connections to close on shutdown. */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Maximum time a readiness probe waits for a dependency (PostgreSQL / Redis). */
export const DEPENDENCY_CHECK_TIMEOUT_MS = 2_000;

// --- Authentication (PHASE 03) ------------------------------------------------------------

/** HttpOnly cookie carrying the refresh token. Scoped to the auth routes only. */
export const REFRESH_COOKIE_NAME = 'asra_refresh';
export const REFRESH_COOKIE_PATH = `${API_PREFIX}/auth`;

/**
 * Rate limits for the public auth endpoints, per client IP and fixed window.
 * Login counts only FAILED attempts so a user who logs in successfully is never throttled.
 */
export const AUTH_RATE_LIMITS = {
  login: { windowMinutes: 15, limit: 10, skipSuccessfulRequests: true },
  register: { windowMinutes: 60, limit: 5 },
  refresh: { windowMinutes: 15, limit: 60 },
  forgotPassword: { windowMinutes: 15, limit: 5 },
  resetPassword: { windowMinutes: 15, limit: 10 },
  verifyEmail: { windowMinutes: 15, limit: 10 },
  resendVerification: { windowMinutes: 15, limit: 3 },
} as const;

export type AuthRateLimitName = keyof typeof AUTH_RATE_LIMITS;
