import { cva } from 'class-variance-authority';
import * as React from 'react';

import { Container } from '@/components/layout/container';
import { cn } from '@/lib/utils';

const sectionTones = cva('py-section', {
  variants: {
    tone: {
      default: '',
      /** Sunken ivory band for alternating sections. */
      muted: 'bg-asra-ivory-200',
      /** Deep green band. At most one per page; text switches to ivory with gold accents. */
      brand: 'bg-asra-green-900 text-asra-ivory',
    },
  },
  defaultVariants: { tone: 'default' },
});

type SectionProps = Omit<React.ComponentProps<'section'>, 'title'> & {
  /** Short marker above the title, e.g. "Our courses". */
  eyebrow?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional link/button aligned with the heading (e.g. "View all courses"). */
  action?: React.ReactNode;
  headingLevel?: 'h1' | 'h2' | 'h3' | 'h4';
  align?: 'start' | 'center';
  tone?: 'default' | 'muted' | 'brand';
  containerSize?: 'page' | 'narrow' | 'prose' | 'full';
};

/**
 * Page section with consistent vertical rhythm and an optional heading block. The section is
 * labelled by its title, so it appears as a named region to assistive technology.
 */
export function Section({
  eyebrow,
  title,
  description,
  action,
  headingLevel: Heading = 'h2',
  align = 'start',
  tone = 'default',
  containerSize = 'page',
  className,
  children,
  id,
  ...props
}: SectionProps) {
  const generatedId = React.useId();
  const titleId = title ? `${id ?? generatedId}-title` : undefined;
  const brand = tone === 'brand';
  const centered = align === 'center';

  return (
    <section
      id={id}
      aria-labelledby={titleId}
      data-slot="section"
      className={cn(sectionTones({ tone }), className)}
      {...props}
    >
      <Container size={containerSize} className="grid gap-8 sm:gap-10">
        {title || eyebrow || description || action ? (
          <div
            className={cn(
              'flex flex-col gap-4',
              centered ? 'items-center text-center' : 'sm:flex-row sm:items-end sm:justify-between',
            )}
          >
            <div className={cn('grid max-w-2xl gap-3', centered && 'justify-items-center')}>
              {eyebrow ? (
                <p
                  className={cn(
                    'type-eyebrow',
                    brand ? 'text-asra-gold-500' : 'text-asra-gold-800',
                  )}
                >
                  {eyebrow}
                </p>
              ) : null}
              {title ? (
                <Heading
                  id={titleId}
                  className={cn('type-h2', brand ? 'text-asra-ivory' : 'text-heading')}
                >
                  {title}
                </Heading>
              ) : null}
              {description ? (
                <div
                  className={cn(
                    'type-body-lg',
                    brand ? 'text-asra-green-200' : 'text-muted-foreground',
                  )}
                >
                  {description}
                </div>
              ) : null}
            </div>
            {action ? <div className="shrink-0">{action}</div> : null}
          </div>
        ) : null}
        {children}
      </Container>
    </section>
  );
}
