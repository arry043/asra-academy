import { CheckCircle2 } from 'lucide-react';

import { cn } from '@/lib/utils';

/** Simple list with check icons (course topics, learning components). */
export function CheckList({
  items,
  columns = 1,
  className,
}: {
  items: string[];
  columns?: 1 | 2;
  className?: string;
}) {
  return (
    <ul className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2', className)}>
      {items.map((item) => (
        <li key={item} className="flex items-start gap-3 type-body text-foreground">
          <CheckCircle2 className="mt-1 size-5 shrink-0 text-asra-green-600" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}
