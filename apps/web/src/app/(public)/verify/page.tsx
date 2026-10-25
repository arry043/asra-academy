import type { Metadata } from 'next';
import { CertificateVerificationView } from '@/components/public/certificate-verification';
import { buildPageMetadata } from '@/lib/seo';

export const metadata: Metadata = buildPageMetadata({
  title: 'Verify Certificate',
  description: 'Verify the authenticity of credentials and certificates issued by ASRA Academy.',
  path: '/verify',
});

export default function VerifyPage() {
  return <CertificateVerificationView />;
}
