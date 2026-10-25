import type { Metadata } from 'next';
import { CertificatesAdmin } from '@/components/admin/certificates-admin';

export const metadata: Metadata = { title: 'Certificates' };

export default function CertificatesAdminPage() {
  return <CertificatesAdmin />;
}
