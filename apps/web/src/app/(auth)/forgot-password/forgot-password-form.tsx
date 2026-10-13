'use client';

import { emailOnlySchema } from '@asra/validation';
import * as React from 'react';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { FormAlert, FormField, SubmitButton } from '@/components/auth/form-controls';
import { authApi } from '@/lib/auth/auth-api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';

export function ForgotPasswordForm() {
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [result, setResult] = React.useState<{ tone: 'success' | 'error'; message: string } | null>(
    null,
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = validateForm(emailOnlySchema, {
      email: new FormData(event.currentTarget).get('email'),
    });
    setResult(null);
    if (parsed.errors) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    try {
      await authApi.forgotPassword(parsed.data);
      // Same message whether or not the account exists.
      setResult({
        tone: 'success',
        message:
          'If an account exists for that address, we have sent a password reset link. It expires soon, so use it promptly.',
      });
    } catch (error) {
      const { message, fieldErrors } = describeError(error);
      setErrors(fieldErrors);
      setResult({ tone: 'error', message });
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Forgot your password?"
      description="Enter your account email and we will send you a link to choose a new password."
      footer={
        <p>
          Remembered it? <AuthLink href="/login">Back to sign in</AuthLink>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {result ? <FormAlert tone={result.tone}>{result.message}</FormAlert> : null}
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
        />
        <SubmitButton pending={pending} pendingLabel="Sending link…">
          Send reset link
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
