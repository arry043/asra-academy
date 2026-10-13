'use client';

import { loginSchema } from '@asra/validation';
import { Loader2, LogOut, ShieldCheck } from 'lucide-react';
import * as React from 'react';
import { AuthCard, AuthLink } from '@/components/auth/auth-card';
import { useAuth } from '@/components/auth/auth-provider';
import { FormAlert, FormField, PasswordField, SubmitButton } from '@/components/auth/form-controls';
import { Button } from '@/components/ui/button';
import { ApiClientError } from '@/lib/api';
import { authApi } from '@/lib/auth/auth-api';
import { describeError, validateForm, type FieldErrors } from '@/lib/auth/form-errors';

export function LoginForm() {
  const { status, user } = useAuth();

  if (status === 'loading') {
    return (
      <AuthCard title="Sign in">
        <p
          className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking your session…
        </p>
      </AuthCard>
    );
  }
  return status === 'authenticated' && user ? <SignedIn /> : <SignInForm />;
}

function SignInForm() {
  const { login } = useAuth();
  const [pending, setPending] = React.useState(false);
  const [errors, setErrors] = React.useState<FieldErrors>({});
  const [alert, setAlert] = React.useState<{ tone: 'error' | 'info'; message: string } | null>(
    null,
  );
  const [unverifiedEmail, setUnverifiedEmail] = React.useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const parsed = validateForm(loginSchema, {
      email: form.get('email'),
      password: form.get('password'),
    });
    setAlert(null);
    setUnverifiedEmail(null);
    if (parsed.errors) return setErrors(parsed.errors);

    setErrors({});
    setPending(true);
    try {
      await login(parsed.data);
    } catch (error) {
      if (error instanceof ApiClientError && error.code === 'EMAIL_NOT_VERIFIED') {
        setUnverifiedEmail(parsed.data.email);
        setAlert({ tone: 'info', message: error.message });
      } else {
        const { message, fieldErrors } = describeError(error);
        setErrors(fieldErrors);
        setAlert({ tone: 'error', message });
      }
    } finally {
      setPending(false);
    }
  }

  return (
    <AuthCard
      title="Welcome back"
      description="Sign in to continue learning with ASRA Academy."
      footer={
        <p>
          New to ASRA Academy? <AuthLink href="/register">Create an account</AuthLink>
        </p>
      }
    >
      <form onSubmit={onSubmit} noValidate className="grid gap-5">
        {alert ? (
          <FormAlert tone={alert.tone}>
            <p>{alert.message}</p>
            {unverifiedEmail ? <ResendVerification email={unverifiedEmail} /> : null}
          </FormAlert>
        ) : null}
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          required
          error={errors.email}
        />
        <div className="grid gap-2">
          <PasswordField
            id="password"
            label="Password"
            autoComplete="current-password"
            required
            error={errors.password}
          />
          <div className="text-right text-sm">
            <AuthLink href="/forgot-password">Forgot password?</AuthLink>
          </div>
        </div>
        <SubmitButton pending={pending} pendingLabel="Signing in…">
          Sign in
        </SubmitButton>
      </form>
    </AuthCard>
  );
}

function ResendVerification({ email }: { email: string }) {
  const [state, setState] = React.useState<'idle' | 'pending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = React.useState('');

  async function resend() {
    setState('pending');
    try {
      await authApi.resendVerification({ email });
      setState('sent');
    } catch (error) {
      setMessage(describeError(error).message);
      setState('error');
    }
  }

  if (state === 'sent')
    return <p className="font-medium">A new verification link is on its way.</p>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={resend}
        disabled={state === 'pending'}
      >
        {state === 'pending' ? <Loader2 className="animate-spin" aria-hidden /> : null}
        Resend verification email
      </Button>
      {state === 'error' ? <span className="text-destructive">{message}</span> : null}
    </div>
  );
}

/**
 * Shown after a successful sign-in. PHASE 03 has no dashboards, so this card confirms the
 * session (identity, roles) and offers sign-out.
 */
function SignedIn() {
  const { user, logout, logoutAllDevices } = useAuth();
  const [pending, setPending] = React.useState<'one' | 'all' | null>(null);
  if (!user) return null;

  async function signOut(scope: 'one' | 'all') {
    setPending(scope);
    try {
      await (scope === 'all' ? logoutAllDevices() : logout());
    } finally {
      setPending(null);
    }
  }

  return (
    <AuthCard title={`Hello, ${user.fullName.split(' ')[0]}`} description="You are signed in.">
      <div className="grid gap-5">
        <dl className="grid gap-3 rounded-lg bg-asra-green-50 p-4 text-sm">
          <div className="grid grid-cols-[5.5rem_1fr] gap-2">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-medium break-all">{user.email}</dd>
          </div>
          <div className="grid grid-cols-[5.5rem_1fr] items-start gap-2">
            <dt className="text-muted-foreground">Role</dt>
            <dd className="flex flex-wrap gap-1.5">
              {user.roles.map((role) => (
                <span
                  key={role}
                  className="inline-flex items-center gap-1 rounded-full bg-asra-gold-100 px-2.5 py-0.5 text-xs font-semibold text-asra-gold-800"
                >
                  <ShieldCheck className="size-3.5" aria-hidden />
                  {role.replace('_', ' ')}
                </span>
              ))}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">Your learning dashboard is coming soon.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button onClick={() => signOut('one')} disabled={pending !== null} size="lg">
            {pending === 'one' ? (
              <Loader2 className="animate-spin" aria-hidden />
            ) : (
              <LogOut aria-hidden />
            )}
            Sign out
          </Button>
          <Button
            variant="outline"
            onClick={() => signOut('all')}
            disabled={pending !== null}
            size="lg"
          >
            {pending === 'all' ? <Loader2 className="animate-spin" aria-hidden /> : null}
            Sign out everywhere
          </Button>
        </div>
      </div>
    </AuthCard>
  );
}
