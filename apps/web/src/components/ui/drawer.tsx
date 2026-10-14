'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { Dialog as DialogPrimitive } from 'radix-ui';
import * as React from 'react';

import { DialogOverlay, OverlayCloseButton } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

/**
 * Drawer: a modal panel that slides in from an edge (mobile navigation, filters, detail panes).
 * Built on the same Radix Dialog as `Dialog`, so focus trapping, Escape and focus restoration
 * behave identically.
 */
function Drawer(props: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger(props: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose(props: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-slot="drawer-close" {...props} />;
}

const drawerVariants = cva(
  'fixed z-50 flex flex-col gap-4 bg-card shadow-overlay duration-300 ease-standard data-[state=closed]:animate-out data-[state=open]:animate-in',
  {
    variants: {
      side: {
        left: 'inset-y-0 left-0 h-full w-[min(20rem,calc(100%-3rem))] border-r data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
        right:
          'inset-y-0 right-0 h-full w-[min(24rem,calc(100%-3rem))] border-l data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
        bottom:
          'inset-x-0 bottom-0 max-h-[85dvh] rounded-t-2xl border-t data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
      },
    },
    defaultVariants: { side: 'right' },
  },
);

function DrawerContent({
  className,
  children,
  side,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> &
  VariantProps<typeof drawerVariants> & { showCloseButton?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        data-slot="drawer-content"
        className={cn(drawerVariants({ side }), className)}
        {...props}
      >
        {children}
        {showCloseButton ? <OverlayCloseButton /> : null}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

function DrawerHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-header"
      className={cn('grid gap-1 border-b px-5 py-4 pr-14', className)}
      {...props}
    />
  );
}

function DrawerBody({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-body"
      className={cn('min-h-0 flex-1 overflow-y-auto px-5 pb-5', className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn('mt-auto flex flex-col gap-2 border-t px-5 py-4', className)}
      {...props}
    />
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-slot="drawer-title"
      className={cn('type-h4 text-heading', className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-slot="drawer-description"
      className={cn('type-body-sm text-muted-foreground', className)}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
};
