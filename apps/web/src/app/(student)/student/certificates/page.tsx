import type { Metadata } from 'next';

import { CertificatesPage } from '@/components/student/student-pages';

export const metadata: Metadata = { title: 'Certificates' };

export default function StudentCertificatesPage() {
  return <CertificatesPage />;
}
