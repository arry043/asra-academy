import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';

import { Badge, type BadgeProps } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CardLink } from '@/types/education';

/** Building blocks shared by the education cards, so metadata and statuses look the same everywhere. */

export interface StatusDefinition {
  label: string;
  variant: NonNullable<BadgeProps['variant']>;
  icon: LucideIcon;
}

/** Status badge: always an icon + a word, never colour alone. */
export function StatusBadge({
  status,
  className,
}: {
  status: StatusDefinition;
  className?: string;
}) {
  const Icon = status.icon;
  return (
    <Badge variant={status.variant} className={className}>
      <Icon aria-hidden />
      {status.label}
    </Badge>
  );
}

/** Icon + text metadata list (instructor, date, duration…). Skips empty entries. */
export function MetaList({
  items,
  className,
}: {
  items: { icon: LucideIcon; label: string; value: React.ReactNode | null | undefined }[];
  className?: string;
}) {
  const visible = items.filter(
    (item) => item.value !== null && item.value !== undefined && item.value !== '',
  );
  if (visible.length === 0) return null;
  return (
    <dl className={cn('grid gap-1.5 type-body-sm text-muted-foreground', className)}>
      {visible.map(({ icon: Icon, label, value }) => (
        <div key={label} className="flex min-w-0 items-start gap-2">
          <dt className="mt-0.5 shrink-0">
            <Icon className="size-4 text-asra-sage" aria-hidden />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="min-w-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** The single primary link of a card. */
export function CardLinkButton({
  action,
  variant = 'outline',
  className,
}: {
  action: CardLink;
  variant?: 'default' | 'outline' | 'secondary';
  className?: string;
}) {
  return (
    <Button asChild variant={variant} size="sm" className={className}>
      <Link href={action.href}>{action.label}</Link>
    </Button>
  );
}
