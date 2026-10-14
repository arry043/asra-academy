import Image from 'next/image';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { siteConfig } from '@/config/site';

/** Branded card used by every authentication page. Its title is the page's `<h1>`. */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="w-full max-w-md gap-6 rounded-2xl border-asra-green-100 shadow-raised motion-safe:animate-fade-up sm:py-8">
      <CardHeader className="items-center justify-items-center gap-3 text-center sm:px-8">
        <Link
          href="/"
          className="mx-auto rounded-full focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Image
            src={siteConfig.logo.emblem.src}
            width={56}
            height={56}
            alt={`${siteConfig.name} home`}
            priority
            className="size-14"
          />
        </Link>
        <CardTitle as="h1" className="type-h2">
          {title}
        </CardTitle>
        {description ? (
          <CardDescription className="text-balance">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent className="sm:px-8">{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center border-t pt-6 type-body-sm text-muted-foreground sm:px-8">
          {footer}
        </CardFooter>
      ) : null}
    </Card>
  );
}

/** Text link styled for the auth pages (gold underline accent on the brand green). */
export function AuthLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-sm font-medium text-asra-green-700 decoration-asra-gold-500 decoration-2 underline-offset-4 hover:underline focus-visible:underline focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
