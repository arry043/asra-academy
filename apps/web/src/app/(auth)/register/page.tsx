import type { Metadata } from 'next';
import { RegisterForm } from './register-form';

export const metadata: Metadata = {
  title: 'Create your account',
  description: 'Create a student account at ASRA Academy.',
};

export default function RegisterPage() {
  return <RegisterForm />;
}
