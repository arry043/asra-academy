/** A rendered message, independent of any email provider. */
export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  /** Stable identifier of the template, for logs and tests (never contains personal data). */
  template: 'email-verification' | 'password-reset' | 'account-exists';
}

/**
 * Provider adapter. A production implementation (provider pending — CLIENT-CLARIFICATIONS Q-01)
 * must throw when the provider rejects or cannot accept the message, so callers never report a
 * delivery that did not happen.
 */
export interface EmailTransport {
  readonly name: string;
  send(message: EmailMessage & { from: string }): Promise<void>;
}
