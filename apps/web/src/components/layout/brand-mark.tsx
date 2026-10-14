import Image from 'next/image';
import Link from 'next/link';

import { siteConfig } from '@/config/site';
import { cn } from '@/lib/utils';

/**
 * Compact horizontal brand lockup for headers and sidebars: the official emblem on an ivory tile
 * (the same treatment as the app icons, so it stays legible on green surfaces) plus the academy
 * name as text. A client-supplied horizontal logo should replace this when available (V-01).
 */
export function BrandMark({
  href = '/',
  tone = 'light',
  className,
}: {
  href?: string;
  /** `light` for ivory/white surfaces, `dark` for green surfaces. */
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex shrink-0 items-center gap-2.5 rounded-lg focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span className="flex size-10 items-center justify-center rounded-lg bg-asra-ivory ring-1 ring-asra-gold-500/40">
        <Image
          src={siteConfig.logo.emblem.src}
          width={36}
          height={36}
          alt=""
          className="size-9"
          priority
        />
      </span>
      <span className="grid leading-none">
        <span
          className={cn(
            'font-display text-lg font-bold tracking-tight',
            tone === 'dark' ? 'text-asra-ivory' : 'text-asra-green-900',
          )}
        >
          ASRA{' '}
          <span className={tone === 'dark' ? 'text-asra-gold-500' : 'text-asra-gold-800'}>
            Academy
          </span>
        </span>
        <span
          className={cn(
            'mt-1 text-[0.625rem] font-semibold tracking-[0.16em] uppercase',
            tone === 'dark' ? 'text-asra-green-200' : 'text-muted-foreground',
          )}
        >
          {siteConfig.tagline}
        </span>
      </span>
    </Link>
  );
}
