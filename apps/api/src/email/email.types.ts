/** A rendered message, independent of any email provider. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Optional HTML alternative (PHASE 11 branded layout). `text` is always sent too. */
  html?: string;
  /**
   * Provider-side idempotency key: a retried send with the same key is not delivered twice
   * (Resend keeps keys for 24 hours). Never contains personal data.
   */
  idempotencyKey?: string;
  /** Stable identifier of the template, for logs and tests (never contains personal data). */
  template:
    | 'email-verification'
    | 'password-reset'
    | 'account-exists'
    | 'payment-confirmation'
    | 'refund-update'
    | 'notification';
}

/** What the provider told us when it accepted a message. Acceptance is NOT inbox delivery. */
export interface EmailReceipt {
  /** Provider message id (Resend email id); null for transports without one. */
  providerMessageId: string | null;
}

/**
 * Provider adapter (console, memory, resend — see transports.ts). Implementations must throw when
 * the provider rejects or cannot accept the message, so callers never report a delivery that did
 * not happen.
 */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage & { from: string }): Promise<EmailReceipt | void>;
}
