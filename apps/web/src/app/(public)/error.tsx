'use client';

import { RotateCcw } from 'lucide-react';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { Button } from '@/components/ui/button';

/** Error boundary for public pages: keeps the header and footer, offers retry and a way home. */
export default function PublicError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <Container size="narrow" className="grid justify-items-center gap-4 py-section text-center">
      <p className="type-eyebrow text-asra-gold-800">Something went wrong</p>
      <h1 className="type-h2 text-heading">This page could not be displayed</h1>
      <p className="max-w-lg type-body text-muted-foreground">
        Please try again. If the problem continues, return to the homepage or contact us.
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={() => retry()}>
          <RotateCcw aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to homepage</Link>
        </Button>
      </div>
    </Container>
  );
}
