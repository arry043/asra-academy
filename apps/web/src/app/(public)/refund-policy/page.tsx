import { LegalPage } from '@/components/public/legal-page';
import { legalDocuments } from '@/content/legal';
import { buildPageMetadata } from '@/lib/seo';

const document = legalDocuments['refund-policy'];

export const metadata = buildPageMetadata({
  title: document.title,
  description: document.seoDescription,
  path: document.path,
});

export default function RefundPolicyPage() {
  return <LegalPage document={document} />;
}
