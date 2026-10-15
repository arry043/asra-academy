import type { Metadata } from 'next';
import { Suspense } from 'react';

import { AuthCard } from '@/components/auth/auth-card';

import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your ASRA Academy account.',
};

export default function LoginPage() {
  // LoginForm reads `?next=` (useSearchParams), so it renders inside a Suspense boundary.
  return (
    <Suspense fallback={<AuthCard title="Sign in">{null}</AuthCard>}>
      <LoginForm />
    </Suspense>
  );
}
