export const API_PREFIX = '/api/v1';

export const APP_NAME = 'ASRA Academy API';

/** Maximum time to wait for in-flight requests and connections to close on shutdown. */
export const SHUTDOWN_TIMEOUT_MS = 10_000;

/** Maximum time a readiness probe waits for a dependency (PostgreSQL / Redis). */
export const DEPENDENCY_CHECK_TIMEOUT_MS = 2_000;
