import Link from 'next/link';
import * as React from 'react';

import { Section } from '@/components/layout/section';
import { WhatsAppLink } from '@/components/public/whatsapp-link';
import { Button } from '@/components/ui/button';

/**
 * Closing call to action (green brand band — at most one per page). Every button goes to a real
 * route; the WhatsApp button appears only when a number is configured.
 */
export function CtaBand({
  title = 'Start your learning journey with ASRA Academy',
  description = 'Explore our programmes, ask us anything, or begin your admission enquiry today.',
  whatsAppTopic,
  primary = { label: 'Explore courses', href: '/courses' },
  secondary = { label: 'Admission', href: '/admission' },
  tertiary = { label: 'Contact us', href: '/contact' },
}: {
  title?: string;
  description?: React.ReactNode;
  whatsAppTopic?: string;
  primary?: { label: string; href: string };
  secondary?: { label: string; href: string };
  tertiary?: { label: string; href: string } | null;
}) {
  return (
    <Section tone="brand" align="center" title={title} description={description}>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild variant="accent" size="lg">
          <Link href={primary.href}>{primary.label}</Link>
        </Button>
        <Button
          asChild
          size="lg"
          variant="outline"
          className="border-asra-ivory/40 bg-transparent text-asra-ivory hover:bg-asra-ivory/10 hover:text-asra-ivory"
        >
          <Link href={secondary.href}>{secondary.label}</Link>
        </Button>
        {tertiary ? (
          <Button
            asChild
            size="lg"
            variant="ghost"
            className="text-asra-ivory hover:bg-asra-ivory/10 hover:text-asra-ivory"
          >
            <Link href={tertiary.href}>{tertiary.label}</Link>
          </Button>
        ) : null}
        <WhatsAppLink
          topic={whatsAppTopic}
          size="lg"
          variant="outline"
          className="border-asra-ivory/40 bg-transparent text-asra-ivory hover:bg-asra-ivory/10 hover:text-asra-ivory"
        />
      </div>
    </Section>
  );
}
