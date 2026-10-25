import type { PublicCertificateVerificationDto } from '@asra/types';
import type { Metadata } from 'next';
import { CertificateVerificationView } from '@/components/public/certificate-verification';
import { publicEnv } from '@/lib/env';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ certificateId: string }> };

export const dynamic = 'force-dynamic';

async function fetchCertificate(code: string): Promise<PublicCertificateVerificationDto | null> {
  try {
    const res = await fetch(
      `${publicEnv.NEXT_PUBLIC_API_URL}/api/v1/certificates/verify/${encodeURIComponent(code)}`,
      {
        headers: { Accept: 'application/json' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    const json = await res.json();
    return json.success ? json.data : null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateId } = await params;
  const cert = await fetchCertificate(certificateId);

  if (cert) {
    return buildPageMetadata({
      title: `Certificate Verification: ${cert.recipientName} - ${cert.courseTitle}`,
      description: `Official ASRA Academy Certificate of Completion for ${cert.recipientName} (${cert.courseTitle}). Certificate ID: ${cert.certificateNumber}.`,
      path: `/verify/${certificateId}`,
    });
  }

  return buildPageMetadata({
    title: 'Verify Certificate',
    description: `Certificate verification for ${certificateId} at ASRA Academy.`,
    path: `/verify/${certificateId}`,
  });
}

export default async function CertificateVerificationPage({ params }: Props) {
  const { certificateId } = await params;
  const cert = await fetchCertificate(certificateId);

  return (
    <CertificateVerificationView initialCode={certificateId} initialData={cert} notFound={!cert} />
  );
}
