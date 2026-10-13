import { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

/**
 * Error codes meaning "the database cannot be reached / is overloaded". With the Prisma 7 driver
 * adapter an unreachable server surfaces as P1001 (model queries) or P2010 (raw queries), both
 * carrying `driverAdapterError.cause.kind = 'DatabaseNotReachable'`; some socket failures carry
 * the Node error code instead. https://www.prisma.io/docs/orm/reference/error-reference
 */
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'P1001', // can't reach database server
  'P1002', // database server timed out
  'P1008', // operations timed out
  'P1017', // server closed the connection
  'P2024', // timed out fetching a connection from the pool
  'P2037', // too many database connections opened
]);

/** Driver-adapter error kinds (@prisma/adapter-pg) with the same meaning. */
const UNAVAILABLE_ADAPTER_KINDS = new Set([
  'DatabaseNotReachable',
  'ConnectionClosed',
  'SocketTimeout',
  'TooManyConnections',
  'TlsConnectionError',
  'AuthenticationFailed',
  'DatabaseDoesNotExist',
]);

/** PostgreSQL SQLSTATE for CHECK violations (constraints defined in the migration SQL). */
const PG_CHECK_VIOLATION = '23514';

interface AdapterErrorCause {
  kind?: string;
  originalCode?: string;
}

/** The driver-adapter cause Prisma 7 attaches as `meta.driverAdapterError.cause`. */
function adapterCause(error: Prisma.PrismaClientKnownRequestError): AdapterErrorCause | undefined {
  const adapterError = error.meta?.driverAdapterError as { cause?: AdapterErrorCause } | undefined;
  return adapterError?.cause;
}

function isUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (UNAVAILABLE_CODES.has(error.code)) return true;
  const kind = adapterCause(error)?.kind;
  return kind !== undefined && UNAVAILABLE_ADAPTER_KINDS.has(kind);
}

/**
 * Translates a Prisma/database error into a safe, client-facing `AppError`.
 *
 * Returns `undefined` for anything that is not a recognised database error, so the caller can
 * treat it as an unexpected 500. Responses never include SQL, constraint names, connection
 * strings or row values (PostgreSQL CHECK errors embed the whole failing row).
 *
 * Services that need a domain-specific message (e.g. "email already registered") should catch
 * the Prisma error themselves and throw their own `AppError`.
 */
export function toAppError(error: unknown): AppError | undefined {
  if (isUnavailable(error)) {
    return new AppError('SERVICE_UNAVAILABLE', 'The database is temporarily unavailable');
  }
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return undefined;

  switch (error.code) {
    case 'P2002':
      return new AppError('CONFLICT', 'A record with the same unique value already exists');
    case 'P2003':
    case 'P2014':
      return new AppError('CONFLICT', 'The operation conflicts with a related record');
    case 'P2001':
    case 'P2018':
    case 'P2025':
      return new AppError('NOT_FOUND', 'The requested record was not found');
    case 'P2000':
      return new AppError('VALIDATION_ERROR', 'A value is too long for its field');
    case 'P2011':
      return new AppError('VALIDATION_ERROR', 'A required value is missing');
    case 'P2033':
      return new AppError('VALIDATION_ERROR', 'A number is out of range');
  }

  if (adapterCause(error)?.originalCode === PG_CHECK_VIOLATION) {
    return new AppError('VALIDATION_ERROR', 'A value violates a data integrity rule');
  }
  return undefined;
}
