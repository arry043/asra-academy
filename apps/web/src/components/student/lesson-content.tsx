'use client';

import type {
  FeatureStatus,
  LessonProgressUpdateDto,
  StudentLessonDto,
  StudentResourceDto,
} from '@asra/types';
import { Download, ExternalLink, FileText, Link2, Lock } from 'lucide-react';

import { RESOURCE_TYPE_LABELS } from '@/lib/admin/format';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { detectVideoSource, formatBytes } from '@/lib/student/learning';

import { QuizPanel } from './assessment-pages';
import { AssignmentPanel } from './assignment-panel';
import { VideoPlayer } from './video-player';

const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

/**
 * The content area of one lesson. Staff-written text is rendered as plain text (never HTML), and
 * every link is an https:// URL validated by the API, opened with `noopener noreferrer`.
 */
export function LessonContent({
  lesson,
  features,
  onVideoProgress,
}: {
  lesson: StudentLessonDto;
  features: { quiz: FeatureStatus; assignment: FeatureStatus };
  onVideoProgress: (update: LessonProgressUpdateDto) => void;
}) {
  const external = lesson.resources.filter(
    (resource): resource is StudentResourceDto & { access: { kind: 'external'; url: string } } =>
      resource.access.kind === 'external',
  );

  return (
    <div className="grid gap-6">
      {lesson.contentType === 'VIDEO'
        ? (() => {
            const video = external.find((resource) => resource.type === 'VIDEO');
            return video ? (
              <VideoPlayer
                key={lesson.id}
                lessonId={lesson.id}
                title={lesson.title}
                source={detectVideoSource(video.access.url, video.mimeType)}
                resumeAt={lesson.progress?.videoPositionSeconds ?? null}
                onProgress={onVideoProgress}
              />
            ) : (
              <Unavailable text="The video for this lesson is not available yet. Please check back later or ask your faculty." />
            );
          })()
        : null}

      {lesson.contentType === 'PDF' || lesson.contentType === 'DOCUMENT'
        ? (() => {
            const kind =
              lesson.contentType === 'PDF' ? ['PDF'] : ['DOCUMENT', 'PRESENTATION', 'PDF'];
            const file = external.find((resource) => kind.includes(resource.type));
            return file ? (
              <PrimaryResource resource={file} icon={<FileText />} action="Open" />
            ) : (
              <Unavailable text="The study material for this lesson is not available yet." />
            );
          })()
        : null}

      {lesson.contentType === 'LINK'
        ? (() => {
            const link = external[0];
            return link ? (
              <PrimaryResource resource={link} icon={<Link2 />} action="Visit" />
            ) : (
              <Unavailable text="The link for this lesson is not available yet." />
            );
          })()
        : null}

      {lesson.contentType === 'QUIZ' || lesson.contentType === 'ASSIGNMENT' ? (
        <Alert
          tone="info"
          title={lesson.contentType === 'QUIZ' ? 'About this quiz' : 'About this assignment'}
        >
          <p>
            {lesson.contentType === 'QUIZ' ? features.quiz.message : features.assignment.message}{' '}
            This lesson does not count towards your course progress.
          </p>
        </Alert>
      ) : null}

      {lesson.body ? (
        <section aria-labelledby="lesson-body-heading" className="grid gap-2">
          <h2 id="lesson-body-heading" className="type-h3 text-heading">
            {lesson.contentType === 'QUIZ' || lesson.contentType === 'ASSIGNMENT'
              ? 'Instructions'
              : lesson.contentType === 'TEXT'
                ? 'Lesson'
                : 'Notes'}
          </h2>
          <div className="max-w-prose rounded-xl border bg-card p-5 type-body break-words whitespace-pre-wrap">
            {lesson.body}
          </div>
        </section>
      ) : lesson.contentType === 'TEXT' ? (
        <Unavailable text="This lesson has no text yet." />
      ) : null}

      {lesson.contentType === 'ASSIGNMENT' ? (
        <AssignmentPanel key={lesson.id} lessonId={lesson.id} />
      ) : null}

      {lesson.contentType === 'QUIZ' ? <QuizPanel key={lesson.id} lessonId={lesson.id} /> : null}

      {lesson.resources.length > 0 ? (
        <section aria-labelledby="resources-heading" className="grid gap-3">
          <h2 id="resources-heading" className="type-h3 text-heading">
            Study materials
          </h2>
          <ul className="grid gap-2">
            {lesson.resources.map((resource) => (
              <li
                key={resource.id}
                className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4"
              >
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <span className="type-label break-words">{resource.title}</span>
                  <span className="flex flex-wrap items-center gap-2 type-caption text-muted-foreground">
                    <Badge variant="outline">{RESOURCE_TYPE_LABELS[resource.type]}</Badge>
                    {formatBytes(resource.sizeBytes)}
                    {resource.access.kind === 'external' ? hostOf(resource.access.url) : null}
                  </span>
                </div>
                {resource.access.kind === 'external' ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={resource.access.url} target="_blank" rel="noopener noreferrer">
                      {resource.type === 'PDF' || resource.type === 'DOCUMENT' ? (
                        <Download aria-hidden />
                      ) : (
                        <ExternalLink aria-hidden />
                      )}
                      Open
                      <span className="sr-only"> {resource.title} (opens in a new tab)</span>
                    </a>
                  </Button>
                ) : (
                  <span className="flex items-center gap-1.5 type-caption text-muted-foreground">
                    <Lock className="size-3.5" aria-hidden />
                    {resource.access.reason}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function PrimaryResource({
  resource,
  icon,
  action,
}: {
  resource: StudentResourceDto & { access: { kind: 'external'; url: string } };
  icon: React.ReactNode;
  action: string;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-asra-green-50 p-6 sm:flex-row sm:items-center">
      <span
        aria-hidden
        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-card text-asra-green-700 shadow-card [&_svg]:size-5"
      >
        {icon}
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="type-label break-words">{resource.title}</span>
        <span className="type-caption text-muted-foreground">
          {[
            RESOURCE_TYPE_LABELS[resource.type],
            formatBytes(resource.sizeBytes),
            hostOf(resource.access.url),
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </div>
      <Button asChild>
        <a href={resource.access.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden /> {action}
          <span className="sr-only"> {resource.title} (opens in a new tab)</span>
        </a>
      </Button>
    </div>
  );
}

function Unavailable({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card p-6 type-body text-muted-foreground">
      {text}
    </div>
  );
}
