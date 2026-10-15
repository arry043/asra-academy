import type { LiveClassSummary } from '@/types/education';

/**
 * Public live-class schedule for the homepage. Live classes are a confirmed requirement
 * (REQ-LIV-001), but the provider (F-01) and timetables are not, so there are no sessions to show.
 * The homepage explains the format instead of listing invented sessions. Join links must never be
 * published here: they belong to enrolled students in the student portal (PHASE 11).
 */
export const upcomingPublicLiveClasses: LiveClassSummary[] = [];
