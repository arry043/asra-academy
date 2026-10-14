import { CardLinkButton } from '@/components/asra/shared/card-parts';
import { Avatar } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { FacultySummary } from '@/types/education';

type FacultyCardProps = FacultySummary & { headingLevel?: 'h2' | 'h3' | 'h4'; className?: string };

/**
 * Faculty profile card. Displays only the details supplied (public fields pending C-02); the photo
 * falls back to initials. Never populate with invented names or credentials.
 */
export function FacultyCard({
  name,
  designation,
  subjects,
  bio,
  imageSrc,
  action,
  headingLevel = 'h3',
  className,
}: FacultyCardProps) {
  const visibleSubjects = subjects?.filter(Boolean) ?? [];

  return (
    <Card className={cn('h-full items-center text-center', className)}>
      <CardHeader className="w-full justify-items-center gap-3">
        <Avatar name={name} src={imageSrc} size="xl" />
        <div className="grid gap-1">
          <CardTitle as={headingLevel} className="break-words">
            {name}
          </CardTitle>
          {designation ? <CardDescription>{designation}</CardDescription> : null}
        </div>
      </CardHeader>

      {visibleSubjects.length > 0 || bio ? (
        <CardContent className="grid w-full gap-3">
          {visibleSubjects.length > 0 ? (
            <ul className="flex flex-wrap justify-center gap-1.5" aria-label="Subjects">
              {visibleSubjects.map((subject) => (
                <li key={subject}>
                  <Badge>{subject}</Badge>
                </li>
              ))}
            </ul>
          ) : null}
          {bio ? <p className="line-clamp-4 type-body-sm text-muted-foreground">{bio}</p> : null}
        </CardContent>
      ) : null}

      {action ? (
        <CardFooter className="mt-auto">
          <CardLinkButton action={action} />
        </CardFooter>
      ) : null}
    </Card>
  );
}
