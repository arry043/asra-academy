import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Concise status indicator. Status badges must carry a meaningful word ("Live", "Overdue"), and
 * optionally an icon — never colour alone.
 */
const badgeVariants = cva(
  'inline-flex w-fit shrink-0 items-center gap-1 rounded-sm border px-2 py-0.5 text-xs leading-5 font-semibold whitespace-nowrap [&>svg]:pointer-events-none [&>svg]:size-3.5',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-secondary text-secondary-foreground',
        secondary: 'border-transparent bg-muted text-muted-foreground',
        accent: 'border-transparent bg-asra-gold-100 text-asra-gold-800',
        success: 'border-transparent bg-success-soft text-success',
        warning: 'border-transparent bg-warning-soft text-warning',
        info: 'border-transparent bg-info-soft text-info',
        destructive: 'border-transparent bg-destructive-soft text-destructive',
        outline: 'border-border bg-transparent text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

type BadgeProps = React.ComponentProps<'span'> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean };

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot.Root : 'span';
  return (
    <Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants, type BadgeProps };
