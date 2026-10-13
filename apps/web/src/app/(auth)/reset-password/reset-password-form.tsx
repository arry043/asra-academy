'use client';

import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH, passwordSchema } from '@asra/validation';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';
import Link from 'next/link';
import * as React from 'react';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { FormAlert, PasswordField, SubmitButton } from '@/components/auth/form-controls';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth/auth-api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { clearFragmentToken, useFragmentToken } from '@/lib/auth/use-fragment-token';

const newPasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export function ResetPasswordForm() {
  const token = useFragmentToken();
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) return;
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(newPasswordSchema, {
      password: form.get('password'),
      confirmPassword: form.get('confirmPassword'),
    });
    setError(null);
    if (parsed.errors) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    try {
      await authApi.resetPassword({ token, password: parsed.data.password });
      clearFragmentToken();
      setDone(true);
    } catch (caught) {
      const { message, fieldErrors } = describeError(caught);
      setErrors(fieldErrors);
      setError(message);
    } finally {
      setPending(false);
    }
  }

  if (token === undefined) {
    return (
      <AuthCard title="Choose a new password">
        <p className="flex justify-center py-6" role="status">
          <Loader2 className="size-5 animate-spin text-muted-foreground" aria-label="Loading" />
        </p>
      </AuthCard>
    );
  }

  if (done) {
    return (
      <AuthCard title="Password updated">
        <div className="grid gap-5">
          <FormAlert tone="success">
            Your password has been reset and you have been signed out on all devices.
          </FormAlert>
          <Button asChild size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  if (!token) {
    return (
      <AuthCard
        title="Link not valid"
        footer={
          <p>
            <AuthLink href="/forgot-password">Request a new reset link</AuthLink>
          </p>
        }
      >
        <FormAlert tone="error">
          This page must be opened from the password reset link in your email.
        </FormAlert>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="After resetting, you will be signed out on all devices."
      footer={
        <p>
          Link expired? <AuthLink href="/forgot-password">Request a new one</AuthLink>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {error ? <FormAlert tone="error">{error}</FormAlert> : null}
        <PasswordField
          id="password"
          label="New password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          hint={`At least ${PASSWORD_MIN_LENGTH} characters.`}
          error={errors.password}
        />
        <PasswordField
          id="confirmPassword"
          label="Confirm new password"
          autoComplete="new-password"
          required
          maxLength={PASSWORD_MAX_LENGTH}
          error={errors.confirmPassword}
        />
        <SubmitButton pending={pending} pendingLabel="Saving…">
          Reset password
        </SubmitButton>
      </form>
    </AuthCard>
  );
}
