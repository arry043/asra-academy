import { BookOpen, CalendarClock, CheckCircle2, Clock, PlayCircle, XCircle } from 'lucide-react';

import {
  CardLinkButton,
  MetaList,
  StatusBadge,
  type StatusDefinition,
} from '@/components/asra/shared/card-parts';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateTime, formatDuration, toValidDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { ExamStatus, ExamSummary } from '@/types/education';

const STATUS: Record<ExamStatus, StatusDefinition> = {
  scheduled: { label: 'Scheduled', variant: 'info', icon: CalendarClock },
  open: { label: 'Open now', variant: 'success', icon: PlayCircle },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle },
};

/** Exam summary. Presentational only — delivery, scheduling and grading arrive in Phase 09. */
export function ExamCard({
  title,
  courseName,
  scheduledAt,
  durationMinutes,
  status,
  action,
  headingLevel = 'h3',
  className,
}: ExamSummary & { headingLevel?: 'h2' | 'h3' | 'h4'; className?: string }) {
  const scheduled = toValidDate(scheduledAt);

  return (
    <Card className={cn('h-full', className)} data-status={status}>
      <CardHeader>
        <CardTitle as={headingLevel} className="line-clamp-2">
          {title}
        </CardTitle>
        <CardAction>
          <StatusBadge status={STATUS[status]} />
        </CardAction>
      </CardHeader>
      <CardContent>
        <MetaList
          items={[
            { icon: BookOpen, label: 'Course', value: courseName },
            {
              icon: CalendarClock,
              label: 'Scheduled',
              value: scheduled ? (
                <time dateTime={scheduled.toISOString()}>{formatDateTime(scheduled)}</time>
              ) : null,
            },
            { icon: Clock, label: 'Duration', value: formatDuration(durationMinutes) },
          ]}
        />
      </CardContent>
      {action ? (
        <CardFooter className="mt-auto">
          <CardLinkButton action={action} variant={status === 'open' ? 'default' : 'outline'} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
