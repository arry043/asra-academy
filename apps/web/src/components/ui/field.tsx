'use client';

import { AlertCircle } from 'lucide-react';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type FieldProps = {
  label: React.ReactNode;
  /** Id given to the control. Generated when omitted. */
  id?: string;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  /** Shows a visual "(optional)" marker; required fields are the default in ASRA forms. */
  optional?: boolean;
  className?: string;
  /** Exactly one control element (Input, PasswordInput, SelectTrigger…). */
  children: React.ReactElement;
};

/**
 * Label + control + hint/error. Wires `id`, `aria-describedby` and `aria-invalid` onto the control
 * (via Radix Slot), so errors are announced with the field and never rely on colour alone.
 */
function Field({ label, id, hint, error, optional, className, children }: FieldProps) {
  const generatedId = React.useId();
  const controlId = id ?? generatedId;
  const hintId = hint ? `${controlId}-hint` : undefined;
  const errorId = error ? `${controlId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div
      data-slot="field"
      data-invalid={error ? true : undefined}
      className={cn('grid gap-2', className)}
    >
      <Label htmlFor={controlId}>
        {label}
        {optional ? <span className="font-normal text-muted-foreground">(optional)</span> : null}
      </Label>
      <Slot.Root
        id={controlId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
      >
        {children}
      </Slot.Root>
      {hint ? (
        <p id={hintId} className="type-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 type-body-sm text-destructive">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

export { Field, type FieldProps };
