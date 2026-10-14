import * as React from 'react';
import { Slot } from 'radix-ui';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full type-label whitespace-nowrap transition-[color,background-color,border-color,box-shadow,transform] duration-150 ease-standard outline-none select-none focus-visible:ring-[3px] focus-visible:ring-ring/50 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        /** Main action of a view. One per area. */
        default: 'bg-primary text-primary-foreground shadow-card hover:bg-asra-green-800',
        /** Gold emphasis CTA (e.g. "Explore Courses" on green or ivory heroes). Use sparingly. */
        accent: 'bg-accent text-accent-foreground shadow-card hover:bg-asra-gold-600',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-asra-green-200',
        outline:
          'border border-primary/25 bg-card text-primary hover:border-primary/40 hover:bg-secondary dark:border-input dark:text-foreground',
        ghost: 'text-foreground hover:bg-secondary hover:text-secondary-foreground',
        destructive:
          'bg-destructive text-destructive-foreground shadow-card hover:bg-destructive/90 focus-visible:ring-destructive/30',
        link: 'h-auto rounded-sm px-0 text-primary underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-control-sm px-4 has-[>svg]:px-3',
        default: 'h-control px-5 has-[>svg]:px-4',
        lg: 'h-control-lg px-7 text-base has-[>svg]:px-6',
        icon: 'size-control',
        'icon-sm': 'size-control-sm',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0 has-[>svg]:px-0' }],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

type ButtonProps = React.ComponentProps<'button'> &
  VariantProps<typeof buttonVariants> & {
    /** Render the child element (e.g. `<Link>`) with button styling instead of a `<button>`. */
    asChild?: boolean;
    /**
     * Shows a spinner, sets `aria-busy` and disables the button so a form cannot be submitted
     * twice. Ignored with `asChild` (links are not submitted).
     */
    loading?: boolean;
    /** Replaces the label while loading, e.g. "Signing in…". */
    loadingText?: React.ReactNode;
  };

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingText,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, className }));

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <>
          <Loader2 className="animate-spin" aria-hidden />
          {loadingText ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export { Button, buttonVariants, type ButtonProps };
