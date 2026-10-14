import { Mail } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { Container } from '@/components/layout/container';
import { siteConfig } from '@/config/site';
import type { NavItem } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type FooterProps = {
  columns?: { title: string; links: NavItem[] }[];
  /** Only pass legal links whose pages exist. */
  legalLinks?: NavItem[];
  className?: string;
};

const linkClasses =
  'rounded-sm text-muted-foreground transition-colors hover:text-primary focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none';

/**
 * Site footer: brand, link columns, the confirmed contact email and legal links. Contact details
 * come only from `siteConfig` (client-confirmed) — no invented addresses, phones or socials.
 *
 * Uses a light surface: the supplied logo is dark-on-light only. A dark green footer like the
 * visual reference needs a reversed logo variant (CLIENT-CLARIFICATIONS V-01).
 */
export function Footer({ columns = [], legalLinks = [], className }: FooterProps) {
  const year = new Date().getFullYear();

  return (
    <footer data-slot="footer" className={cn('border-t bg-asra-ivory-200', className)}>
      <Container className="grid gap-10 py-12 md:grid-cols-[minmax(0,1.2fr)_repeat(auto-fit,minmax(10rem,1fr))] md:py-16">
        <div className="grid content-start justify-items-start gap-4">
          <Image
            src={siteConfig.logo.full.src}
            width={siteConfig.logo.full.width}
            height={siteConfig.logo.full.height}
            alt={siteConfig.logo.alt}
            className="h-auto w-28"
          />
          <p className="max-w-xs type-body-sm text-muted-foreground">{siteConfig.description}</p>
          <p className="type-body-sm font-medium text-asra-green-700">{siteConfig.foundedBy}</p>
          <a
            href={`mailto:${siteConfig.contact.email}`}
            className={cn('inline-flex items-center gap-2 type-body-sm', linkClasses)}
          >
            <Mail className="size-4" aria-hidden />
            {siteConfig.contact.email}
          </a>
        </div>

        {columns.map((column) => (
          <nav key={column.title} aria-label={column.title} className="grid content-start gap-3">
            <h2 className="type-eyebrow text-asra-gold-800">{column.title}</h2>
            <ul className="grid gap-2 type-body-sm">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className={linkClasses}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>

      <div className="border-t">
        <Container className="flex flex-col gap-3 py-5 type-caption text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {siteConfig.name}. {siteConfig.tagline}
          </p>
          {legalLinks.length > 0 ? (
            <nav aria-label="Legal">
              <ul className="flex flex-wrap gap-x-5 gap-y-2">
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className={linkClasses}>
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </Container>
      </div>
    </footer>
  );
}
