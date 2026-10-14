import { cva, type VariantProps } from 'class-variance-authority';
import * as React from 'react';

import { cn } from '@/lib/utils';

const cardVariants = cva(
  'flex flex-col gap-5 rounded-xl border py-5 text-card-foreground sm:py-6',
  {
    variants: {
      variant: {
        /** Default raised surface on ivory. */
        default: 'bg-card shadow-card',
        /** Flat surface for nested or dense areas (no shadow). */
        flat: 'bg-card',
        /** Sunken ivory panel — groups content without competing with cards. */
        muted: 'border-transparent bg-asra-ivory-200',
        /** Green brand panel. Use for one highlight per view at most. */
        brand:
          'border-transparent bg-asra-green-900 text-asra-ivory [&_[data-slot=card-description]]:text-asra-green-200',
      },
      /** Hover lift for cards that are wholly clickable. Motion is skipped with reduced motion. */
      interactive: {
        true: 'transition-[box-shadow,border-color,transform] duration-200 ease-standard hover:border-primary/25 hover:shadow-raised has-[a:focus-visible]:ring-[3px] has-[a:focus-visible]:ring-ring/50 motion-safe:hover:-translate-y-0.5',
        false: '',
      },
    },
    defaultVariants: { variant: 'default', interactive: false },
  },
);

type CardProps = React.ComponentProps<'div'> & VariantProps<typeof cardVariants>;

function Card({ className, variant, interactive, ...props }: CardProps) {
  return (
    <div
      data-slot="card"
      className={cn(cardVariants({ variant, interactive }), className)}
      {...props}
    />
  );
}

function CardHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-header"
      className={cn(
        'grid auto-rows-min grid-rows-[auto_auto] items-start gap-1.5 px-5 has-data-[slot=card-action]:grid-cols-[1fr_auto] sm:px-6',
        className,
      )}
      {...props}
    />
  );
}

/** Card heading. Renders an `<h3>` by default; pass `as` to fit the page outline. */
function CardTitle({
  className,
  as: Comp = 'h3',
  ...props
}: React.ComponentProps<'h3'> & { as?: 'h1' | 'h2' | 'h3' | 'h4' | 'p' }) {
  return (
    <Comp data-slot="card-title" className={cn('type-h4 text-heading', className)} {...props} />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return (
    <p
      data-slot="card-description"
      className={cn('type-body-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

/** Top-right slot in the header (menu, badge, small button). */
function CardAction({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-action"
      className={cn('col-start-2 row-span-2 row-start-1 self-start justify-self-end', className)}
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('px-5 sm:px-6', className)} {...props} />;
}

function CardFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="card-footer"
      className={cn('flex flex-wrap items-center gap-3 px-5 sm:px-6', className)}
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  cardVariants,
  type CardProps,
};
