/**
 * Meeting-provider port (PHASE 11, docs/LIVE-CLASSES.md §3). The live-class service depends on
 * this interface only; Google specifics live in google-meet.provider.ts. Adding another provider
 * means another implementation of this interface — the domain model already stores a provider id
 * and an opaque provider meeting id.
 */

export interface CreatedMeeting {
  /** Provider's stable identifier (Google Meet: "spaces/{id}"). */
  meetingId: string;
  /** https:// link participants open. */
  joinUrl: string;
}

export interface MeetingProvider {
  /** Stored in `live_class_sessions.provider`. */
  readonly id: 'google_meet';
  /** False when the server has no credentials for it (nothing is attempted). */
  readonly configured: boolean;
  /**
   * Creates one meeting. NOT idempotent at the provider: callers must hold the session's meeting
   * claim and must not blindly retry after a timeout (a meeting may already exist).
   */
  createMeeting(): Promise<CreatedMeeting>;
}

export type MeetingProviderErrorKind =
  | 'NOT_CONFIGURED'
  /** Credentials rejected, refresh token expired or revoked — an operator must re-authorise. */
  | 'AUTHORIZATION'
  /** Authorised, but the API is disabled, the scope is missing or the account is not eligible. */
  | 'PERMISSION'
  | 'RATE_LIMITED'
  /** Network error, timeout or provider 5xx. The meeting MAY have been created (timeouts). */
  | 'UNAVAILABLE'
  /** The provider answered with something that is not a usable meeting. */
  | 'INVALID_RESPONSE';

/** Carries a staff-safe message: never a token, secret, request body or raw provider text. */
export class MeetingProviderError extends Error {
  readonly kind: MeetingProviderErrorKind;
  readonly httpStatus: number | null;

  constructor(kind: MeetingProviderErrorKind, message: string, httpStatus: number | null = null) {
    super(message);
    this.name = 'MeetingProviderError';
    this.kind = kind;
    this.httpStatus = httpStatus;
  }
}
