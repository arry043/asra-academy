'use client';

import { RotateCcw } from 'lucide-react';
import * as React from 'react';

import { PageTransition } from '@/components/layout/page-transition';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const ENTRANCES = [
  { name: 'Fade', className: 'motion-safe:animate-fade-in', token: 'animate-fade-in · 200ms' },
  {
    name: 'Slide (fade-up)',
    className: 'motion-safe:animate-fade-up',
    token: 'animate-fade-up · 300ms',
  },
  { name: 'Scale', className: 'motion-safe:animate-scale-in', token: 'animate-scale-in · 200ms' },
] as const;

/** Replays entrance animations by re-mounting (changing `key`). */
export function EntranceDemo() {
  const [run, setRun] = React.useState(0);
  return (
    <div className="grid gap-4">
      <div>
        <Button variant="outline" size="sm" onClick={() => setRun((value) => value + 1)}>
          <RotateCcw aria-hidden /> Replay
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {ENTRANCES.map((item) => (
          <div
            key={`${item.name}-${run}`}
            className={cn('grid gap-1 rounded-xl border bg-card p-4 shadow-card', item.className)}
          >
            <p className="type-label text-heading">{item.name}</p>
            <p className="type-caption text-muted-foreground">{item.token}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PageTransitionDemo() {
  const [run, setRun] = React.useState(0);
  return (
    <div className="grid gap-3">
      <div>
        <Button variant="outline" size="sm" onClick={() => setRun((value) => value + 1)}>
          <RotateCcw aria-hidden /> Simulate navigation
        </Button>
      </div>
      <PageTransition key={run} className="rounded-xl border bg-card p-4 shadow-card">
        <p className="type-label text-heading">Page content</p>
        <p className="type-caption text-muted-foreground">
          animate-page-in · 250ms · opacity + translateY only
        </p>
      </PageTransition>
    </div>
  );
}

const STEPS = [0, 35, 70, 100];

export function ProgressMotionDemo() {
  const [value, setValue] = React.useState(35);
  return (
    <div className="grid gap-3">
      <Progress value={value} label="Demo progress" showValue />
      <div className="flex flex-wrap gap-2" role="group" aria-label="Set demo progress">
        {STEPS.map((step) => (
          <Button
            key={step}
            variant={value === step ? 'secondary' : 'ghost'}
            size="sm"
            aria-pressed={value === step}
            onClick={() => setValue(step)}
          >
            {step}%
          </Button>
        ))}
      </div>
    </div>
  );
}
