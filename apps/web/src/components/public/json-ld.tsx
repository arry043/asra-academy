import { serializeJsonLd } from '@/lib/seo';

/** Structured data for search engines. Content must match what the page visibly shows. */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // Safe: serializeJsonLd escapes "<", so the payload cannot close the script element.
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
