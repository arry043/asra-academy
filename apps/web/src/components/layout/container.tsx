import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

const containerVariants = cva('mx-auto w-full px-gutter', {
  variants: {
    size: {
      /** 1216px — default for pages and dashboards. */
      page: 'max-w-page',
      /** 896px — forms and media-heavy articles. */
      narrow: 'max-w-narrow',
      /** 672px — long-form reading. */
      prose: 'max-w-prose-content',
      /** Full width with side padding only. */
      full: 'max-w-none',
    },
  },
  defaultVariants: { size: 'page' },
});

type ContainerProps = React.ComponentProps<'div'> &
  VariantProps<typeof containerVariants> & { asChild?: boolean };

/** Centred content column with responsive side padding (16px → 32px) and a capped width. */
export function Container({ className, size, asChild = false, ...props }: ContainerProps) {
  const Comp = asChild ? Slot.Root : 'div';
  return (
    <Comp data-slot="container" className={cn(containerVariants({ size }), className)} {...props} />
  );
}
