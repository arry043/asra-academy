import { CheckCircle2 } from 'lucide-react';

import { CardLinkButton } from '@/components/asra/shared/card-parts';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { clampProgress, cn, toPercent } from '@/lib/utils';
import type { ProgressSummary } from '@/types/education';

/**
 * Progress summary for a course or goal. Values are clamped to 0…max; missing or invalid data shows
 * "No progress yet" rather than a misleading 0%. Measurement rules are pending (A-07).
 */
export function ProgressCard({
  title,
  value,
  max = 100,
  detail,
  action,
  headingLevel = 'h3',
  className,
}: ProgressSummary & { headingLevel?: 'h2' | 'h3' | 'h4'; className?: string }) {
  const clamped = clampProgress(value, max);
  const percent = clamped === null ? null : toPercent(clamped, max);
  const complete = percent === 100;

  return (
    <Card className={cn('h-full', className)}>
      <CardHeader>
        <CardTitle as={headingLevel} className="line-clamp-2">
          {title}
        </CardTitle>
        {detail ? <CardDescription>{detail}</CardDescription> : null}
      </CardHeader>
      <CardContent className="grid gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-h2 text-heading tabular-nums" aria-hidden>
            {percent === null ? '—' : `${percent}%`}
          </p>
          {complete ? (
            <p className="flex items-center gap-1 type-caption font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Completed
            </p>
          ) : percent === null ? (
            <p className="type-caption text-muted-foreground">No progress yet</p>
          ) : null}
        </div>
        <Progress value={clamped} max={max} label={`${title} progress`} />
      </CardContent>
      {action ? (
        <CardFooter className="mt-auto">
          <CardLinkButton action={action} variant="secondary" />
        </CardFooter>
      ) : null}
    </Card>
  );
}
