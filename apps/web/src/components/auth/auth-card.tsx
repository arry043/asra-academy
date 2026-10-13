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

/** Branded card used by every authentication page. */
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
    <Card className="w-full max-w-md animate-in rounded-2xl border-asra-green-100 shadow-lg shadow-asra-green-900/5 duration-300 fade-in-0 slide-in-from-bottom-2">
      <CardHeader className="items-center gap-3 text-center">
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
        <CardTitle className="font-display text-2xl text-asra-green-900">{title}</CardTitle>
        {description ? (
          <CardDescription className="text-balance">{description}</CardDescription>
        ) : null}
      </CardHeader>
      <CardContent>{children}</CardContent>
      {footer ? (
        <CardFooter className="justify-center border-t pt-6 text-sm text-muted-foreground">
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
      className="font-medium text-asra-green-700 decoration-asra-gold-500 decoration-2 underline-offset-4 hover:underline focus-visible:underline focus-visible:outline-none"
    >
      {children}
    </Link>
  );
}
