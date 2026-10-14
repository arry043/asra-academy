import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDashed,
} from 'lucide-react';

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
import { formatDateTime, toValidDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AssignmentStatus, AssignmentSummary } from '@/types/education';

const STATUS: Record<AssignmentStatus, StatusDefinition> = {
  pending: { label: 'Not submitted', variant: 'warning', icon: CircleDashed },
  submitted: { label: 'Submitted', variant: 'info', icon: CheckCircle2 },
  overdue: { label: 'Overdue', variant: 'destructive', icon: AlertTriangle },
  graded: { label: 'Graded', variant: 'success', icon: Award },
};

/** Assignment summary. Presentational only — submission workflows arrive in Phase 09. */
export function AssignmentCard({
  title,
  courseName,
  dueAt,
  status,
  resultLabel,
  action,
  headingLevel = 'h3',
  className,
}: AssignmentSummary & { headingLevel?: 'h2' | 'h3' | 'h4'; className?: string }) {
  const due = toValidDate(dueAt);

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
              label: 'Due',
              value: due ? (
                <>
                  Due <time dateTime={due.toISOString()}>{formatDateTime(due)}</time>
                </>
              ) : null,
            },
            { icon: Award, label: 'Result', value: status === 'graded' ? resultLabel : null },
          ]}
        />
      </CardContent>
      {action ? (
        <CardFooter className="mt-auto">
          <CardLinkButton action={action} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
