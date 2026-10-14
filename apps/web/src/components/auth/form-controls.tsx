'use client';

import * as React from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { cn } from '@/lib/utils';

/*
 * Auth-form adapters over the design-system primitives (Field, Input, PasswordInput, Alert,
 * Button). The API is unchanged from PHASE 03: `id` doubles as the input `name`, which the forms
 * read through FormData.
 */

type FieldProps = Omit<React.ComponentProps<'input'>, 'id'> & {
  id: string;
  label: string;
  error?: string;
  hint?: string;
};

/** Labelled input with an accessible error/hint (`aria-invalid` + `aria-describedby`). */
export function FormField({ id, label, error, hint, ...props }: FieldProps) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <Input name={id} {...props} />
    </Field>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordField({ id, label, error, hint, ...props }: Omit<FieldProps, 'type'>) {
  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <PasswordInput name={id} {...props} />
    </Field>
  );
}

const TONE = { error: 'error', success: 'success', info: 'info' } as const;

/** Status message. Errors are announced immediately (`role="alert"`), others politely. */
export function FormAlert({
  tone,
  children,
  className,
}: {
  tone: keyof typeof TONE;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Alert tone={TONE[tone]} className={className}>
      {children}
    </Alert>
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
      loading={pending}
      loadingText={pendingLabel}
      className={cn('w-full', className)}
    >
      {children}
    </Button>
  );
}
