import { CheckCircle2, Database, GraduationCap, Server, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiHealth } from '@/lib/api';
import { publicEnv } from '@/lib/env';

// Foundation page only — the real ASRA homepage is built in the Public Website phase.
// Rendered per request so the API status is live rather than captured at build time.
export const dynamic = 'force-dynamic';

const stack = [
  { label: 'Frontend', value: 'Next.js · TypeScript · Tailwind CSS · shadcn/ui' },
  { label: 'Backend', value: 'Node.js · Express · TypeScript' },
  { label: 'Database', value: 'PostgreSQL · Prisma (Neon in production)' },
  { label: 'Local infra', value: 'Docker Compose · PostgreSQL · Redis' },
];

export default async function FoundationPage() {
  const health = await getApiHealth();

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center gap-10 px-4 py-16 sm:px-6">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <GraduationCap className="size-6" aria-hidden />
          </span>
          <span className="rounded-full bg-asra-gold-100 px-3 py-1 text-xs font-semibold tracking-wide text-asra-gold-700 uppercase">
            Phase 01 · Foundation
          </span>
        </div>
        <h1 className="text-4xl font-bold text-asra-green-900 sm:text-5xl">
          ASRA <span className="text-asra-gold-600">Academy</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Online learning platform &amp; LMS. This page verifies that the web application, design
          tokens and API connection are working.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button asChild size="lg">
            <a href={`${publicEnv.NEXT_PUBLIC_API_URL}/health`} target="_blank" rel="noreferrer">
              <Server aria-hidden /> Open API health
            </a>
          </Button>
          <Button variant="accent" size="lg" disabled>
            Explore Courses (coming soon)
          </Button>
        </div>
      </header>

      <section className="grid gap-6 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="size-5 text-primary" aria-hidden /> API status
            </CardTitle>
            <CardDescription>{publicEnv.NEXT_PUBLIC_API_URL}/health</CardDescription>
          </CardHeader>
          <CardContent>
            {health.ok ? (
              <p className="flex items-center gap-2 font-medium text-success">
                <CheckCircle2 className="size-5" aria-hidden />
                {health.message} ({health.data.environment})
              </p>
            ) : (
              <p className="flex items-center gap-2 font-medium text-destructive">
                <XCircle className="size-5" aria-hidden />
                {health.message} — start it with <code className="text-sm">npm run dev</code>
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="size-5 text-primary" aria-hidden /> Technology stack
            </CardTitle>
            <CardDescription>Locked for the ASRA Academy platform</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-2 text-sm">
              {stack.map((item) => (
                <div key={item.label} className="grid grid-cols-[7rem_1fr] gap-2">
                  <dt className="font-medium text-foreground">{item.label}</dt>
                  <dd className="text-muted-foreground">{item.value}</dd>
                </div>
              ))}
            </dl>
          </CardContent>
        </Card>
      </section>

      <footer className="text-sm text-muted-foreground">
        Built by Marvel&apos;s Techworks for ASRA Academy.
      </footer>
    </main>
  );
}
