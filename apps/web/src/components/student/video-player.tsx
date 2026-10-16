'use client';

import type { LessonProgressUpdateDto } from '@asra/types';
import { ExternalLink, Info } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
  createPlaybackTracker,
  HEARTBEAT_INTERVAL_MS,
  type VideoSource,
} from '@/lib/student/learning';

import { useStudentApi } from './use-student';

/**
 * Plays a lesson video from its source:
 *   - file  → native <video>; played seconds are batched into a heartbeat every 15 s and on
 *             pause/end/leave. The server bounds every credit, so this is telemetry, not proof.
 *   - embed → the provider's privacy-enhanced player (no telemetry is available to us).
 *   - link  → opened in a new tab.
 */
export function VideoPlayer({
  lessonId,
  title,
  source,
  resumeAt,
  onProgress,
}: {
  lessonId: string;
  title: string;
  source: VideoSource;
  resumeAt: number | null;
  onProgress: (update: LessonProgressUpdateDto) => void;
}) {
  if (source.kind === 'file') {
    return (
      <TrackedVideo
        lessonId={lessonId}
        title={title}
        url={source.url}
        resumeAt={resumeAt}
        onProgress={onProgress}
      />
    );
  }
  if (source.kind === 'embed') {
    return (
      <div className="grid gap-2">
        <div className="relative aspect-video overflow-hidden rounded-xl bg-asra-green-950">
          <iframe
            src={source.embedUrl}
            title={`${title} (${source.provider} video)`}
            className="absolute inset-0 size-full"
            allow="fullscreen; picture-in-picture; encrypted-media"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
            loading="lazy"
          />
        </div>
        <p className="flex items-start gap-1.5 type-caption text-muted-foreground">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          Watching progress inside the {source.provider} player is not tracked. Mark the lesson
          complete when you have finished.
        </p>
      </div>
    );
  }
  return (
    <div className="grid justify-items-start gap-3 rounded-xl border border-dashed bg-card p-6">
      <p className="type-body text-muted-foreground">
        This video opens on its host website in a new tab.
      </p>
      <Button asChild>
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          <ExternalLink aria-hidden /> Watch the video
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </Button>
    </div>
  );
}

function TrackedVideo({
  lessonId,
  title,
  url,
  resumeAt,
  onProgress,
}: {
  lessonId: string;
  title: string;
  url: string;
  resumeAt: number | null;
  onProgress: (update: LessonProgressUpdateDto) => void;
}) {
  const api = useStudentApi();
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const tracker = React.useRef(createPlaybackTracker());
  const position = React.useRef(resumeAt ?? 0);
  const onProgressRef = React.useRef(onProgress);
  const [failed, setFailed] = React.useState<'load' | 'save' | null>(null);

  React.useEffect(() => {
    onProgressRef.current = onProgress;
  });

  const send = React.useCallback(
    async (always: boolean) => {
      const playedSeconds = tracker.current.take();
      if (playedSeconds === 0 && !always) return;
      try {
        const update = await api.put<LessonProgressUpdateDto>(
          `/student/lessons/${lessonId}/progress`,
          { positionSeconds: Math.floor(position.current), playedSeconds },
        );
        onProgressRef.current(update);
        setFailed((current) => (current === 'save' ? null : current));
      } catch {
        setFailed('save');
      }
    },
    [api, lessonId],
  );

  React.useEffect(() => {
    const playback = tracker.current;
    const timer = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) void send(false);
    }, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // Leaving the lesson: save what was played since the last heartbeat.
      if (playback.pending >= 1) void send(false);
    };
  }, [send]);

  if (failed === 'load') {
    return (
      <div className="grid justify-items-start gap-3 rounded-xl border border-dashed bg-card p-6">
        <p className="type-body text-muted-foreground">
          This video could not be played in the browser.
        </p>
        <Button asChild variant="outline">
          <a href={url} target="_blank" rel="noopener noreferrer">
            <ExternalLink aria-hidden /> Open the video file
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <video
        ref={videoRef}
        src={url}
        controls
        preload="metadata"
        playsInline
        controlsList="nodownload"
        aria-label={title}
        className="aspect-video w-full rounded-xl bg-asra-green-950"
        onLoadedMetadata={(event) => {
          const video = event.currentTarget;
          if (resumeAt && resumeAt > 5 && resumeAt < video.duration - 5) {
            video.currentTime = resumeAt;
            tracker.current.seek(resumeAt);
          }
        }}
        onTimeUpdate={(event) => {
          position.current = event.currentTarget.currentTime;
          tracker.current.time(event.currentTarget.currentTime);
        }}
        onSeeked={(event) => tracker.current.seek(event.currentTarget.currentTime)}
        onPause={() => void send(true)}
        onEnded={() => void send(true)}
        onError={() => setFailed('load')}
      />
      {failed === 'save' ? (
        <p role="status" className="type-caption text-warning">
          Your viewing progress could not be saved. It will be retried while you watch.
        </p>
      ) : null}
    </div>
  );
}
