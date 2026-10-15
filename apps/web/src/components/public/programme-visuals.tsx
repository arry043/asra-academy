import {
  BookOpenText,
  Briefcase,
  GraduationCap,
  Languages,
  MessageSquareText,
  NotebookPen,
  School,
} from 'lucide-react';
import type * as React from 'react';

import type { CategoryTone } from '@/types/education';

/**
 * Presentation-only icon and pastel tone per programme (no photography has been supplied yet —
 * CLIENT-CLARIFICATIONS T-03). Unknown slugs fall back to the card defaults.
 */
const VISUALS: Record<string, { icon: React.ReactNode; tone: CategoryTone }> = {
  'classes-6-10': { icon: <School />, tone: 'sky' },
  'classes-11-12': { icon: <GraduationCap />, tone: 'violet' },
  english: { icon: <MessageSquareText />, tone: 'mint' },
  entrepreneurship: { icon: <Briefcase />, tone: 'amber' },
  'quranic-studies': { icon: <BookOpenText />, tone: 'teal' },
  arabic: { icon: <Languages />, tone: 'rose' },
  urdu: { icon: <NotebookPen />, tone: 'sky' },
};

export function getProgrammeVisual(slug: string): { icon?: React.ReactNode; tone?: CategoryTone } {
  return VISUALS[slug] ?? {};
}
