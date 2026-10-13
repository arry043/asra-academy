'use client';

import { emailOnlySchema } from '@asra/validation';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { FormAlert, FormField, SubmitButton } from '@/components/auth/form-controls';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/auth/auth-api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';
import { clearFragmentToken, useFragmentToken } from '@/lib/auth/use-fragment-token';

type Outcome = { kind: 'verified' | 'already-verified' } | { kind: 'failed'; message: string };

/** Verifies the emailed token automatically (POST — the token never appears in a request URL). */
export function VerifyEmail() {
  const token = useFragmentToken();
  const [outcome, setOutcome] = React.useState<Outcome | null>(null);
  const started = React.useRef<string | null>(null);

  React.useEffect(() => {
    // Runs once per token (React Strict Mode mounts effects twice in development).
    if (!token || started.current === token) return;
    started.current = token;
    authApi
      .verifyEmail({ token })
      .then((result) => setOutcome({ kind: result.status }))
      .catch((error: unknown) =>
        setOutcome({ kind: 'failed', message: describeError(error).message }),
      )
      .finally(clearFragmentToken);
  }, [token]);

  if (token === null && !outcome) {
    return (
      <AuthCard title="Verify your email">
        <div className="grid gap-5">
          <FormAlert tone="info">
            Open this page from the verification link in your email.
          </FormAlert>
          <ResendForm />
        </div>
      </AuthCard>
    );
  }

  if (!outcome) {
    return (
      <AuthCard title="Verifying your email">
        <p
          className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Please wait…
        </p>
      </AuthCard>
    );
  }

  if (outcome.kind === 'failed') {
    return (
      <AuthCard
        title="Link not valid"
        description="Verification links expire and can only be used once."
      >
        <div className="grid gap-5">
          <FormAlert tone="error">{outcome.message}</FormAlert>
          <ResendForm />
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={outcome.kind === 'verified' ? 'Email verified' : 'Already verified'}>
      <div className="grid justify-items-center gap-5 text-center">
        <span className="inline-flex size-14 animate-in items-center justify-center rounded-full bg-asra-green-100 text-asra-green-700 duration-300 zoom-in-75">
          <CheckCircle2 className="size-7" aria-hidden />
        </span>
        <p className="text-sm text-muted-foreground" role="status">
          {outcome.kind === 'verified'
            ? 'Thank you — your email address is confirmed. You can now sign in.'
            : 'Your email address was already confirmed. You can sign in.'}
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </AuthCard>
  );
}

function ResendForm() {
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
      await authApi.resendVerification(parsed.data);
      setResult({
        tone: 'success',
        message: 'If that address belongs to an unverified account, a new link has been sent.',
      });
    } catch (error) {
      setResult({ tone: 'error', message: describeError(error).message });
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4 border-t pt-5">
      <p className="flex items-center gap-2 text-sm font-medium">
        <XCircle className="size-4 text-muted-foreground" aria-hidden /> Need a new link?
      </p>
      {result ? <FormAlert tone={result.tone}>{result.message}</FormAlert> : null}
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <SubmitButton pending={pending} pendingLabel="Sending…">
        Send a new verification link
      </SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        Or <AuthLink href="/login">go to sign in</AuthLink>
      </p>
    </form>
  );
}
