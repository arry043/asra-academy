'use client';

import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2 } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with an accessible error/hint (`aria-invalid` + `aria-describedby`). */
export function FormField({ id, label, error, hint, className, ...props }: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(' ');
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        name={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={className}
        {...props}
      />
      {hint && !error ? (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField(props: Omit<FieldProps, 'type'>) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <FormField {...props} type={visible ? 'text' : 'password'} className="pr-11" />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        aria-controls={props.id}
        className="absolute top-[1.85rem] right-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden />
        ) : (
          <Eye className="size-4" aria-hidden />
        )}
      </button>
    </div>
  );
}

const ALERT_STYLES = {
  error: {
    icon: AlertCircle,
    className: 'border-destructive/30 bg-destructive/5 text-destructive',
  },
  success: {
    icon: CheckCircle2,
    className: 'border-asra-green-600/30 bg-asra-green-50 text-asra-green-800',
  },
  info: { icon: Info, className: 'border-asra-gold-500/40 bg-asra-gold-100 text-asra-gold-800' },
} as const;

/** Status message. Errors are announced immediately (`role="alert"`), others politely. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: keyof typeof ALERT_STYLES;
  children: React.ReactNode;
  className?: string;
}) {
  const { icon: Icon, className: toneClass } = ALERT_STYLES[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex animate-in items-start gap-2 rounded-lg border px-3 py-2.5 text-sm duration-200 fade-in-0',
        toneClass,
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">{children}</div>
    </div>
  );
}

export function SubmitButton({
  pending,
  children,
  pendingLabel,
  className,
}: {
  pending: boolean;
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
}) {
  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      className={cn('w-full', className)}
    >
      {pending ? (
        <>
          <Loader2 className="animate-spin" aria-hidden /> {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
