import {
  BookOpen,
  CalendarClock,
  CheckCircle2,
  Clock,
  Radio,
  UserRound,
  Video,
  XCircle,
} from 'lucide-react';

import { MetaList, StatusBadge, type StatusDefinition } from '@/components/asra/shared/card-parts';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { formatDateTime, formatDuration, isSafeExternalUrl, toValidDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { LiveClassStatus, LiveClassSummary } from '@/types/education';

const STATUS: Record<LiveClassStatus, StatusDefinition> = {
  scheduled: { label: 'Scheduled', variant: 'info', icon: CalendarClock },
  live: { label: 'Live now', variant: 'destructive', icon: Radio },
  completed: { label: 'Completed', variant: 'secondary', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', variant: 'outline', icon: XCircle },
};

/**
 * Live session summary. Provider-neutral (F-01 pending): it only renders a "Join" link when the
 * session is live AND a safe http(s) join URL is supplied — otherwise no join action is shown.
 * Status is passed in (computed server-side), never derived from the client clock.
 */
export function LiveClassCard({
  title,
  courseName,
  instructorName,
  startsAt,
  durationMinutes,
  status,
  joinUrl,
  headingLevel = 'h3',
  className,
}: LiveClassSummary & { headingLevel?: 'h2' | 'h3' | 'h4'; className?: string }) {
  const start = toValidDate(startsAt);
  const canJoin = status === 'live' && isSafeExternalUrl(joinUrl);

  return (
    <Card
      className={cn('h-full', status === 'live' && 'border-destructive/30', className)}
      data-status={status}
    >
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
            { icon: UserRound, label: 'Instructor', value: instructorName },
            {
              icon: CalendarClock,
              label: 'Starts',
              value: start ? (
                <time dateTime={start.toISOString()}>{formatDateTime(start)}</time>
              ) : null,
            },
            { icon: Clock, label: 'Duration', value: formatDuration(durationMinutes) },
          ]}
        />
      </CardContent>
      {canJoin ? (
        <CardFooter className="mt-auto">
          <Button asChild size="sm" className="w-full sm:w-auto">
            <a href={joinUrl} target="_blank" rel="noopener noreferrer">
              <Video aria-hidden /> Join class
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}
