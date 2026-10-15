'use client';

import type { CourseVisibility, PublicationStatus } from '@asra/types';
import {
  Archive,
  CheckCircle2,
  EyeOff,
  Globe,
  Link2,
  Lock,
  PencilLine,
  RefreshCw,
} from 'lucide-react';
import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LoadingRegion, Skeleton } from '@/components/ui/skeleton';
import { STATUS_BADGE, STATUS_LABELS, VISIBILITY_OPTIONS } from '@/lib/admin/format';

/** Placeholder rows while an admin list or form loads. */
export function LoadingPanel({ label = 'Loading…', rows = 4 }: { label?: string; rows?: number }) {
  return (
    <LoadingRegion label={label} className="grid gap-3 rounded-xl border bg-card p-5 shadow-card">
      {Array.from({ length: rows }, (_, index) => (
        <Skeleton key={index} className="h-10 w-full" />
      ))}
    </LoadingRegion>
  );
}

/** A failed load with a retry action — never a blank screen. */
export function ErrorPanel({
  title = 'Could not load this data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Alert tone="error" title={title}>
      <p>{message}</p>
      {onRetry ? (
        <div>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            <RefreshCw aria-hidden /> Try again
          </Button>
        </div>
      ) : null}
    </Alert>
  );
}

const STATUS_ICONS = { DRAFT: PencilLine, PUBLISHED: CheckCircle2, ARCHIVED: Archive } as const;

export function StatusBadge({ status }: { status: PublicationStatus }) {
  const Icon = STATUS_ICONS[status];
  return (
    <Badge variant={STATUS_BADGE[status]}>
      <Icon aria-hidden />
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const VISIBILITY_ICONS = { PUBLIC: Globe, UNLISTED: Link2, PRIVATE: Lock } as const;

export function VisibilityBadge({ visibility }: { visibility: CourseVisibility }) {
  const Icon = VISIBILITY_ICONS[visibility];
  return (
    <Badge variant="outline" title={VISIBILITY_OPTIONS[visibility].description}>
      <Icon aria-hidden />
      {VISIBILITY_OPTIONS[visibility].label}
    </Badge>
  );
}

export function InactiveBadge() {
  return (
    <Badge variant="secondary">
      <EyeOff aria-hidden />
      Inactive
    </Badge>
  );
}

/**
 * Confirmation for consequential actions (publish, unpublish, delete). The action button shows
 * progress and the dialog stays open on failure so the error can be read.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  onConfirm,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: React.ReactNode;
  confirmLabel: string;
  pendingLabel: string;
  destructive?: boolean;
  /** Resolve to close the dialog; throw to keep it open (show the error yourself). */
  onConfirm: () => Promise<void>;
  children?: React.ReactNode;
}) {
  const [pending, setPending] = React.useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm();
      onOpenChange(false);
    } catch {
      // The caller reports the error; keep the dialog open.
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? 'destructive' : 'default'}
            onClick={confirm}
            loading={pending}
            loadingText={pendingLabel}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Labelled select. Radix `Select` renders no element of its own, so it wraps the `Field` and the
 * trigger is the labelled control (the design-system pattern, see form-demo.tsx).
 */
export function SelectField({
  id,
  label,
  value,
  onValueChange,
  options,
  error,
  hint,
  optional,
  disabled,
  placeholder,
}: {
  id: string;
  label: React.ReactNode;
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  error?: string;
  hint?: React.ReactNode;
  optional?: boolean;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <Field id={id} label={label} error={error} hint={hint} optional={optional}>
        <SelectTrigger>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
      </Field>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} disabled={option.disabled}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/** Native checkbox with the brand accent colour and a visible label. */
export function CheckboxField({
  id,
  label,
  checked,
  onChange,
  hint,
  disabled,
}: {
  id: string;
  label: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2.5 type-label">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="size-4 cursor-pointer rounded border-input accent-primary"
        />
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="pl-6.5 type-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
