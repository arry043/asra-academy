import type { Metadata } from 'next';
import { VerifyEmail } from './verify-email';

export const metadata: Metadata = {
  title: 'Verify your email',
  description: 'Confirm the email address of your ASRA Academy account.',
};

export default function VerifyEmailPage() {
  return <VerifyEmail />;
}
