'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { Toast as ToastPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/*
 * Toast notifications on Radix Toast (already installed via `radix-ui`, so no extra dependency).
 *
 *   toast.success('Saved', { description: 'Your changes are live.' })
 *
 * Mount <Toaster /> once (root layout). Errors use an assertive announcement; others are polite.
 * Each tone has an icon and a title, so meaning never depends on colour. Toasts pause on hover and
 * focus, can be swiped away and are reachable with F8.
 */

type ToastTone = 'success' | 'error' | 'warning' | 'info';

type ToastOptions = { description?: string; durationMs?: number };

type ToastRecord = ToastOptions & { id: number; tone: ToastTone; title: string; open: boolean };

const MAX_VISIBLE = 3;
let records: ToastRecord[] = [];
let nextId = 1;
const listeners = new Set<() => void>();

function emit(next: ToastRecord[]) {
  records = next;
  for (const listener of listeners) listener();
}

function push(tone: ToastTone, title: string, options: ToastOptions = {}): number {
  const id = nextId++;
  emit([...records, { id, tone, title, open: true, ...options }].slice(-MAX_VISIBLE));
  return id;
}

/** Imperative API, callable from any client code. */
const toast = {
  success: (title: string, options?: ToastOptions) => push('success', title, options),
  error: (title: string, options?: ToastOptions) => push('error', title, options),
  warning: (title: string, options?: ToastOptions) => push('warning', title, options),
  info: (title: string, options?: ToastOptions) => push('info', title, options),
  dismiss: (id: number) =>
    emit(records.map((record) => (record.id === id ? { ...record, open: false } : record))),
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
const getSnapshot = () => records;
// Snapshots must be referentially stable, or React re-renders forever.
const EMPTY: ToastRecord[] = [];
const getServerSnapshot = () => EMPTY;

const TONES: Record<ToastTone, { icon: typeof Info; className: string }> = {
  success: { icon: CheckCircle2, className: 'text-success' },
  error: { icon: AlertCircle, className: 'text-destructive' },
  warning: { icon: AlertTriangle, className: 'text-warning' },
  info: { icon: Info, className: 'text-info' },
};

function Toaster() {
  const items = React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    <ToastPrimitive.Provider swipeDirection="right" label="Notifications">
      {items.map((item) => {
        const { icon: Icon, className } = TONES[item.tone];
        return (
          <ToastPrimitive.Root
            key={item.id}
            open={item.open}
            onOpenChange={(open) => {
              if (!open) toast.dismiss(item.id);
            }}
            // After the exit animation, drop the record.
            onAnimationEnd={() => {
              if (!item.open) emit(records.filter((record) => record.id !== item.id));
            }}
            type={item.tone === 'error' ? 'foreground' : 'background'}
            duration={item.durationMs ?? (item.tone === 'error' ? 8000 : 5000)}
            className={cn(
              'group pointer-events-auto relative flex w-full items-start gap-3 rounded-xl border bg-card p-4 pr-11 text-card-foreground shadow-overlay',
              'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2 sm:data-[state=open]:slide-in-from-right-4',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
              'data-[swipe=cancel]:translate-x-0 data-[swipe=cancel]:transition-transform data-[swipe=end]:animate-out data-[swipe=end]:fade-out-0 data-[swipe=move]:translate-x-(--radix-toast-swipe-move-x)',
            )}
          >
            <Icon className={cn('mt-0.5 size-5 shrink-0', className)} aria-hidden />
            <div className="grid gap-0.5">
              <ToastPrimitive.Title className="type-label text-heading">
                {item.title}
              </ToastPrimitive.Title>
              {item.description ? (
                <ToastPrimitive.Description className="type-body-sm text-muted-foreground">
                  {item.description}
                </ToastPrimitive.Description>
              ) : null}
            </div>
            <ToastPrimitive.Close
              aria-label="Dismiss notification"
              className="absolute top-3 right-3 inline-flex size-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <X className="size-4" aria-hidden />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        );
      })}
      <ToastPrimitive.Viewport className="fixed inset-x-0 bottom-0 z-[100] mx-auto flex max-h-dvh w-full flex-col gap-2 p-4 outline-none sm:right-0 sm:left-auto sm:mx-0 sm:max-w-sm" />
    </ToastPrimitive.Provider>
  );
}

export { toast, Toaster, type ToastTone };
