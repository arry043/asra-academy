import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProgrammePage } from '@/components/public/programme-page';
import { getProgramme, getProgrammesByKind } from '@/lib/programmes';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ band: string }> };

/** School education bands: /classes/6-10 and /classes/11-12. */
export const dynamicParams = false;

const PREFIX = '/classes/';

export function generateStaticParams() {
  return getProgrammesByKind('class-band').map((programme) => ({
    band: programme.href.slice(PREFIX.length),
  }));
}

function findBand(band: string) {
  const programme = getProgramme(`classes-${band}`);
  return programme?.kind === 'class-band' ? programme : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const programme = findBand((await params).band);
  if (!programme) return {};
  return buildPageMetadata({
    title: programme.seo.title,
    description: programme.seo.description,
    path: programme.href,
  });
}

export default async function ClassBandPage({ params }: Props) {
  const programme = findBand((await params).band);
  if (!programme) notFound();
  return <ProgrammePage programme={programme} />;
}
