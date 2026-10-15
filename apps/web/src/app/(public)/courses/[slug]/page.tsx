import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

import { ProgrammePage } from '@/components/public/programme-page';
import { getProgramme, getProgrammesByKind } from '@/lib/programmes';
import { buildPageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ slug: string }> };

/** Special courses: /courses/english, /entrepreneurship, /quranic-studies, /arabic, /urdu. */
export const dynamicParams = false;

export function generateStaticParams() {
  return getProgrammesByKind('special-course').map((programme) => ({ slug: programme.slug }));
}

function findCourse(slug: string) {
  const programme = getProgramme(slug);
  return programme?.kind === 'special-course' ? programme : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const programme = findCourse((await params).slug);
  if (!programme) return {};
  return buildPageMetadata({
    title: programme.seo.title,
    description: programme.seo.description,
    path: programme.href,
  });
}

export default async function SpecialCoursePage({ params }: Props) {
  const programme = findCourse((await params).slug);
  if (!programme) notFound();
  return <ProgrammePage programme={programme} />;
}
