'use client';

import { Menu } from 'lucide-react';
import * as React from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { SkipLink } from '@/components/layout/skip-link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { cn } from '@/lib/utils';

type DashboardLayoutProps = {
  /** Navigation for the portal, usually `<Sidebar … />`. Rendered in the rail and the mobile drawer. */
  sidebar: React.ReactNode;
  /** Portal name shown in the top bar and the drawer title, e.g. "Student portal". */
  contextLabel: string;
  /** Right side of the top bar (user menu, notifications…). */
  headerActions?: React.ReactNode;
  /** Optional content pinned to the bottom of the sidebar (help link, version). */
  sidebarFooter?: React.ReactNode;
  brandHref?: string;
  tone?: 'default' | 'admin';
  children: React.ReactNode;
};

/**
 * Shell for authenticated portals: sidebar rail from `lg` up, a top bar, and a focus-trapped
 * drawer for the sidebar on smaller screens. Layout only — no data fetching, no access control.
 * Page content (Server Components) is passed through `children` untouched.
 */
export function DashboardLayout({
  sidebar,
  contextLabel,
  headerActions,
  sidebarFooter,
  brandHref = '/',
  tone = 'default',
  children,
}: DashboardLayoutProps) {
  const [open, setOpen] = React.useState(false);
  const admin = tone === 'admin';

  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a')) setOpen(false);
  }

  const rail = cn(admin ? 'bg-asra-green-900 text-asra-ivory' : 'bg-asra-warm-white');

  return (
    <div
      data-slot="dashboard-layout"
      data-tone={tone}
      className="min-h-dvh bg-background lg:grid lg:grid-cols-[var(--spacing-sidebar)_minmax(0,1fr)]"
    >
      <SkipLink />

      <aside
        className={cn(
          'sticky top-0 hidden h-dvh flex-col border-r lg:flex',
          rail,
          admin && 'border-asra-green-800',
        )}
      >
        <div
          className={cn(
            'flex h-topbar shrink-0 items-center border-b px-4',
            admin && 'border-asra-green-800',
          )}
        >
          <BrandMark href={brandHref} tone={admin ? 'dark' : 'light'} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{sidebar}</div>
        {sidebarFooter ? (
          <div className={cn('shrink-0 border-t px-4 py-3', admin && 'border-asra-green-800')}>
            {sidebarFooter}
          </div>
        ) : null}
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-topbar shrink-0 items-center gap-3 border-b bg-asra-warm-white px-gutter">
          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="-ml-2 lg:hidden"
                aria-label="Open navigation"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </DrawerTrigger>
            <DrawerContent
              side="left"
              onClick={closeOnLink}
              className={cn(
                rail,
                admin &&
                  '[&_[data-slot=overlay-close]]:text-asra-green-100 [&_[data-slot=overlay-close]]:hover:bg-asra-green-800',
              )}
            >
              <DrawerHeader className={cn(admin && 'border-asra-green-800')}>
                <DrawerTitle className={cn(admin && 'text-asra-ivory')}>{contextLabel}</DrawerTitle>
                <DrawerDescription className="sr-only">Portal navigation</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>{sidebar}</DrawerBody>
              {sidebarFooter ? (
                <div className={cn('border-t px-5 py-4', admin && 'border-asra-green-800')}>
                  {sidebarFooter}
                </div>
              ) : null}
            </DrawerContent>
          </Drawer>

          <div className="flex min-w-0 items-center gap-2">
            <span className="lg:hidden">
              <BrandMark
                href={brandHref}
                className="[&>span:last-child]:hidden sm:[&>span:last-child]:grid"
              />
            </span>
            <Badge variant={admin ? 'accent' : 'default'} className="hidden sm:inline-flex">
              {contextLabel}
            </Badge>
          </div>

          {headerActions ? (
            <div className="ml-auto flex items-center gap-2">{headerActions}</div>
          ) : null}
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="flex-1 px-gutter py-6 outline-none lg:py-8"
        >
          <div className="mx-auto grid w-full max-w-page gap-6 lg:gap-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
