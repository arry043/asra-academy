'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn, getInitials } from '@/lib/utils';

const avatarVariants = cva('relative inline-flex shrink-0', {
  variants: {
    size: {
      sm: 'size-8 text-xs',
      default: 'size-10 text-sm',
      lg: 'size-14 text-base',
      xl: 'size-20 text-xl',
    },
  },
  defaultVariants: { size: 'default' },
});

type AvatarStatus = 'online' | 'away' | 'offline';

const STATUS: Record<AvatarStatus, { label: string; className: string }> = {
  online: { label: 'Online', className: 'bg-success' },
  away: { label: 'Away', className: 'bg-asra-gold-500' },
  offline: { label: 'Offline', className: 'bg-asra-sage' },
};

type AvatarProps = VariantProps<typeof avatarVariants> & {
  /** Person's name: used for the initials fallback and the image's alt text. */
  name: string;
  src?: string | null;
  /** Optional presence dot. Its meaning is also exposed as text to screen readers. */
  status?: AvatarStatus;
  className?: string;
};

/**
 * Avatar with image → initials fallback. A missing `src` or an image that fails to load falls back
 * to initials automatically (Radix), so broken-image icons never appear.
 */
function Avatar({ name, src, size, status, className }: AvatarProps) {
  return (
    <span data-slot="avatar" className={cn(avatarVariants({ size }), className)}>
      <AvatarPrimitive.Root className="flex size-full overflow-hidden rounded-full bg-secondary ring-2 ring-card">
        {src ? (
          <AvatarPrimitive.Image
            src={src}
            alt={name}
            className="aspect-square size-full object-cover"
          />
        ) : null}
        <AvatarPrimitive.Fallback
          delayMs={src ? 300 : undefined}
          className="flex size-full items-center justify-center font-semibold text-secondary-foreground"
        >
          <span aria-hidden>{getInitials(name)}</span>
          <span className="sr-only">{name}</span>
        </AvatarPrimitive.Fallback>
      </AvatarPrimitive.Root>
      {status ? (
        <span
          className={cn(
            'absolute right-0 bottom-0 size-[28%] min-h-2 min-w-2 rounded-full ring-2 ring-card',
            STATUS[status].className,
          )}
        >
          <span className="sr-only">{STATUS[status].label}</span>
        </span>
      ) : null}
    </span>
  );
}

export { Avatar, avatarVariants, type AvatarProps, type AvatarStatus };
