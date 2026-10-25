import type { Metadata } from 'next';
import { cache } from 'react';
import { CertificateVerificationView } from '@/components/public/certificate-verification';
import { lookupCertificate, normaliseCertificateNumber } from '@/lib/certificates';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ certificateId: string }> };

// Revocations must show immediately, so every request asks the API (which never caches this).
export const dynamic = 'force-dynamic';

/** One API call per render, shared by `generateMetadata` and the page. */
const lookup = cache(lookupCertificate);

/**
 * PHASE 14: individual verification pages are `noindex` and their metadata never contains the
 * recipient's name (students may be minors; titles and descriptions end up in search results and
 * link previews). The page itself still shows the result to whoever holds the link.
 */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { certificateId } = await params;
  const code = normaliseCertificateNumber(certificateId);
  return buildPageMetadata({
    title: code ? `Verify certificate ${code}` : 'Verify certificate',
    description: 'Check whether a certificate issued by ASRA Academy is authentic and valid.',
    path: code ? `/verify/${code}` : '/verify',
    noIndex: true,
  });
}

export default async function CertificateVerificationPage({ params }: Props) {
  const { certificateId } = await params;
  const result = await lookup(certificateId);

  return <CertificateVerificationView initialCode={certificateId} initialLookup={result} />;
}
