/**
 * Presentational view models for the ASRA education components.
 *
 * These describe what a card can DISPLAY, not a database row: every field beyond the title is
 * optional because the backing data (Phase 06+) and several business rules are not final
 * (CLIENT-CLARIFICATIONS A–K). Map API responses into these shapes at the page level.
 */
import type * as React from 'react';

/** Mirrors the Prisma `PublicationStatus` enum (courses and lessons). */
export type PublicationStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

/** Category tile tones taken from the visual reference (see globals.css `--tone-*`). */
export type CategoryTone = 'sky' | 'mint' | 'amber' | 'violet' | 'rose' | 'teal';

/** An optional call to action rendered as a link. Omit it and the card shows no action. */
export interface CardLink {
  href: string;
  label: string;
}

export interface CourseSummary {
  title: string;
  category?: string;
  subject?: string;
  summary?: string;
  instructorName?: string;
  /** Local path or an allowed remote host (configure `images.remotePatterns` once storage is chosen). */
  imageSrc?: string;
  imageAlt?: string;
  status?: PublicationStatus;
  /** Free text, e.g. "12 weeks". Only show confirmed values. */
  durationLabel?: string;
  /** Language of instruction, e.g. "English", "Urdu" (A-06 pending). */
  language?: string;
  action?: CardLink;
}

export interface FacultySummary {
  name: string;
  designation?: string;
  subjects?: string[];
  bio?: string;
  imageSrc?: string;
  action?: CardLink;
}

export interface CourseCategorySummary {
  name: string;
  description?: string;
  /** Only pass a count that comes from real data. Undefined hides the count entirely. */
  courseCount?: number;
  icon?: React.ReactNode;
  tone?: CategoryTone;
  href?: string;
  /** Language of the name, e.g. "ur" for "اردو". Sets `lang`/`dir` for correct rendering. */
  lang?: string;
}

export interface Testimonial {
  quote: string;
  authorName: string;
  /** e.g. "Parent of a Class 8 student". Only with consent (CLIENT-CLARIFICATIONS U-04). */
  authorContext?: string;
  avatarSrc?: string;
}

export type LiveClassStatus = 'scheduled' | 'live' | 'completed' | 'cancelled';

export interface LiveClassSummary {
  title: string;
  courseName?: string;
  instructorName?: string;
  startsAt?: Date | string;
  durationMinutes?: number;
  status: LiveClassStatus;
  /** Provider join link (F-01 pending). Only shown while `status` is "live" and the URL is http(s). */
  joinUrl?: string;
}

export type AssignmentStatus = 'pending' | 'submitted' | 'overdue' | 'graded';

export interface AssignmentSummary {
  title: string;
  courseName?: string;
  dueAt?: Date | string;
  status: AssignmentStatus;
  /** Shown only for graded work, e.g. "18 / 20" (I-03 grading scale pending). */
  resultLabel?: string;
  action?: CardLink;
}

export type ExamStatus = 'scheduled' | 'open' | 'completed' | 'cancelled';

export interface ExamSummary {
  title: string;
  courseName?: string;
  scheduledAt?: Date | string;
  durationMinutes?: number;
  status: ExamStatus;
  action?: CardLink;
}

export interface ProgressSummary {
  title: string;
  /** Completed amount; missing or invalid values show "No progress yet". */
  value?: number | null;
  max?: number;
  /** e.g. "12 of 20 lessons". */
  detail?: string;
  action?: CardLink;
}
