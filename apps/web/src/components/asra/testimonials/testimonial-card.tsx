import { Quote } from 'lucide-react';

import { Avatar } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { Testimonial } from '@/types/education';

/**
 * Testimonial quote. Only publish real testimonials with consent (guardian consent for minors —
 * CLIENT-CLARIFICATIONS U-04). Never fabricate quotes, identities or outcomes.
 */
export function TestimonialCard({
  quote,
  authorName,
  authorContext,
  avatarSrc,
  className,
}: Testimonial & { className?: string }) {
  return (
    <figure
      data-slot="testimonial-card"
      className={cn(
        'flex h-full flex-col gap-5 rounded-xl border bg-card p-5 shadow-card sm:p-6',
        className,
      )}
    >
      <Quote className="size-7 text-asra-gold-600" aria-hidden />
      <blockquote className="type-body text-foreground">
        <p className="break-words">{quote}</p>
      </blockquote>
      <figcaption className="mt-auto flex items-center gap-3">
        <Avatar name={authorName} src={avatarSrc} size="default" />
        <div className="min-w-0">
          <p className="type-label break-words text-heading">{authorName}</p>
          {authorContext ? (
            <p className="type-caption break-words text-muted-foreground">{authorContext}</p>
          ) : null}
        </div>
      </figcaption>
    </figure>
  );
}
