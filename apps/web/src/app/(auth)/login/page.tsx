import type { Metadata } from 'next';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your ASRA Academy account.',
};

export default function LoginPage() {
  return <LoginForm />;
}
