import { cva, type VariantProps } from 'class-variance-authority';
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';

const alertVariants = cva(
  'flex items-start gap-2.5 rounded-lg border px-3.5 py-3 type-body-sm motion-safe:animate-fade-in',
  {
    variants: {
      tone: {
        info: 'border-info/25 bg-info-soft text-info',
        success: 'border-success/25 bg-success-soft text-success',
        warning: 'border-warning/25 bg-warning-soft text-warning',
        error: 'border-destructive/25 bg-destructive-soft text-destructive',
      },
    },
    defaultVariants: { tone: 'info' },
  },
);

const ICONS = { info: Info, success: CheckCircle2, warning: AlertTriangle, error: AlertCircle };

type AlertProps = Omit<React.ComponentProps<'div'>, 'role'> &
  VariantProps<typeof alertVariants> & { title?: React.ReactNode };

/**
 * Inline status message. Errors are announced immediately (`role="alert"`), other tones politely
 * (`role="status"`). Every tone has its own icon so meaning never depends on colour alone.
 */
function Alert({ className, tone, title, children, ...props }: AlertProps) {
  const resolved = tone ?? 'info';
  const Icon = ICONS[resolved];
  return (
    <div
      data-slot="alert"
      role={resolved === 'error' ? 'alert' : 'status'}
      className={cn(alertVariants({ tone: resolved }), className)}
      {...props}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="grid gap-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children}
      </div>
    </div>
  );
}

export { Alert, alertVariants, type AlertProps };
