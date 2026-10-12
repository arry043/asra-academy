import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { siteConfig } from '@/config/site';

export default function NotFound() {
  const { emblem } = siteConfig.logo;

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col items-center justify-center gap-4 px-4 text-center">
      <Image
        src={emblem.src}
        width={emblem.width}
        height={emblem.height}
        alt=""
        className="size-24"
      />
      <p className="text-sm font-semibold text-asra-gold-800">404</p>
      <h1 className="text-3xl font-bold text-asra-green-900">Page not found</h1>
      <p className="text-muted-foreground">The page you are looking for does not exist.</p>
      <Button asChild>
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
