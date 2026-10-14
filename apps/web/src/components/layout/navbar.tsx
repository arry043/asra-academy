'use client';

import { Menu } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import * as React from 'react';

import { BrandMark } from '@/components/layout/brand-mark';
import { Container } from '@/components/layout/container';
import { SkipLink } from '@/components/layout/skip-link';
import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerBody,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { isActivePath, type NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type NavbarProps = {
  items: NavItem[];
  /** Primary call to action (e.g. "Login / Register"). */
  cta?: { label: string; href: string };
  /**
   * Extra actions on the right (e.g. a signed-in user menu). Rendered as given; session-aware
   * content must come from a component inside the auth provider.
   */
  actions?: React.ReactNode;
  brandHref?: string;
  /** Disable the sticky behaviour (e.g. inside previews). */
  sticky?: boolean;
  className?: string;
};

/**
 * Public site header. Desktop: inline links. Below `lg`: a menu button opens a focus-trapped
 * drawer (Escape closes it and focus returns to the button). Active links use `aria-current`.
 */
export function Navbar({
  items,
  cta,
  actions,
  brandHref = '/',
  sticky = true,
  className,
}: NavbarProps) {
  const pathname = usePathname();
  const [open, setOpen] = React.useState(false);

  // Close the drawer when a link inside it is followed.
  function closeOnLink(event: React.MouseEvent) {
    if ((event.target as Element).closest('a')) setOpen(false);
  }

  return (
    <header
      data-slot="navbar"
      className={cn('z-40 border-b bg-asra-warm-white', sticky && 'sticky top-0', className)}
    >
      <SkipLink />
      <Container className="flex h-topbar items-center gap-4">
        <BrandMark href={brandHref} />

        <nav aria-label="Main" className="ml-auto hidden lg:block">
          <ul className="flex items-center gap-1">
            {items.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'relative inline-flex h-control-sm items-center rounded-full px-3.5 type-label transition-colors outline-none hover:bg-secondary hover:text-secondary-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50',
                      active
                        ? 'text-primary after:absolute after:inset-x-3.5 after:-bottom-px after:h-0.5 after:rounded-full after:bg-asra-gold-500'
                        : 'text-foreground',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          {actions}
          {cta ? (
            <Button asChild variant="accent" size="sm" className="hidden sm:inline-flex">
              <Link href={cta.href}>{cta.label}</Link>
            </Button>
          ) : null}

          <Drawer open={open} onOpenChange={setOpen}>
            <DrawerTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="size-5" aria-hidden />
              </Button>
            </DrawerTrigger>
            <DrawerContent side="right" onClick={closeOnLink}>
              <DrawerHeader>
                <DrawerTitle>Menu</DrawerTitle>
                <DrawerDescription className="sr-only">Site navigation</DrawerDescription>
              </DrawerHeader>
              <DrawerBody>
                <nav aria-label="Main">
                  <ul className="grid gap-1">
                    {items.map((item) => {
                      const active = isActivePath(pathname, item.href, item.exact);
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'flex min-h-control items-center rounded-lg border-l-4 px-3 type-body font-medium transition-colors outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/50',
                              active
                                ? 'border-asra-gold-500 bg-secondary text-primary'
                                : 'border-transparent text-foreground',
                            )}
                          >
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </nav>
              </DrawerBody>
              {cta ? (
                <DrawerFooter>
                  <Button asChild variant="accent" className="w-full">
                    <Link href={cta.href}>{cta.label}</Link>
                  </Button>
                </DrawerFooter>
              ) : null}
            </DrawerContent>
          </Drawer>
        </div>
      </Container>
    </header>
  );
}
