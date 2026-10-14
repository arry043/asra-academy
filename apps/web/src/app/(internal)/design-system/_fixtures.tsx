/**
 * DEMO DATA — for the internal design-system showcase only.
 *
 * Nothing here is real academy data: course names follow the confirmed course list, but every
 * person, quote, date, duration and progress value is a placeholder marked "(demo)". Do NOT import
 * this file from production pages; real data arrives through the API in later phases.
 */
import {
  BookOpenCheck,
  BookText,
  CalendarDays,
  ClipboardList,
  FileText,
  GraduationCap,
  Headphones,
  LayoutDashboard,
  LineChart,
  MonitorPlay,
  Settings,
  ShieldCheck,
  Users,
  Video,
} from 'lucide-react';

import type { NavGroup } from '@/lib/navigation';
import type {
  AssignmentSummary,
  CourseCategorySummary,
  CourseSummary,
  ExamSummary,
  FacultySummary,
  LiveClassSummary,
  ProgressSummary,
  Testimonial,
} from '@/types/education';

export const demoCourses: CourseSummary[] = [
  {
    title: 'Class 9–10 · Mathematics (demo)',
    category: 'Classes 9–10',
    subject: 'Mathematics',
    summary:
      'Placeholder summary showing how two or three lines of course description wrap and clamp.',
    instructorName: 'Demo Faculty A',
    durationLabel: 'Duration (demo)',
    language: 'English',
    imageSrc: '/brand/og-image.png',
    imageAlt: 'ASRA Academy logo used as a placeholder course cover',
    action: { href: '#courses', label: 'View course' },
  },
  {
    title: 'Quranic Studies (demo)',
    category: 'Special course',
    summary: 'No cover image supplied — the card falls back to a neutral branded panel.',
    instructorName: 'Demo Faculty B',
    action: { href: '#courses', label: 'View course' },
  },
  {
    title:
      'English Language — a deliberately long course title to test two-line clamping in narrow cards (demo)',
    category: 'Special course',
    status: 'DRAFT',
  },
];

export const demoFaculty: FacultySummary[] = [
  {
    name: 'Demo Faculty A',
    designation: 'Designation (demo)',
    subjects: ['Mathematics', 'Science'],
    bio: 'Placeholder biography. Public faculty fields are pending client confirmation (C-02).',
    action: { href: '#faculty', label: 'View profile' },
  },
  { name: 'Demo Faculty B', subjects: ['Arabic', 'Quranic Studies'] },
  {
    name: 'Demo Faculty C',
    imageSrc: '/does-not-exist.png',
    designation: 'Broken image → initials',
  },
];

export const demoCategories: CourseCategorySummary[] = [
  {
    name: 'Class 6–8',
    description: 'All subjects',
    tone: 'sky',
    icon: <BookText />,
    href: '#categories',
  },
  {
    name: 'Class 9–10',
    description: 'All subjects',
    tone: 'mint',
    icon: <FileText />,
    href: '#categories',
  },
  {
    name: 'Class 11–12',
    description: 'All subjects',
    tone: 'amber',
    icon: <ClipboardList />,
    href: '#categories',
  },
  {
    name: 'English',
    description: 'Course',
    tone: 'violet',
    icon: <span className="text-sm font-bold">ABC</span>,
    href: '#categories',
  },
  {
    name: 'العربية',
    lang: 'ar',
    description: 'Arabic',
    tone: 'rose',
    icon: (
      <span lang="ar" className="text-xl font-bold">
        ق
      </span>
    ),
  },
  {
    name: 'اردو',
    lang: 'ur',
    description: 'Urdu',
    tone: 'teal',
    icon: (
      <span lang="ur" className="text-lg font-bold">
        ا
      </span>
    ),
  },
];

export const demoTestimonials: Testimonial[] = [
  {
    quote:
      'Placeholder testimonial text. Real testimonials will be published only with consent from the student and guardian (CLIENT-CLARIFICATIONS U-04).',
    authorName: 'Demo Parent',
    authorContext: 'Context line (demo)',
  },
];

export const demoLiveClasses: LiveClassSummary[] = [
  {
    title: 'Algebra revision (demo)',
    courseName: 'Class 9–10 · Mathematics',
    instructorName: 'Demo Faculty A',
    startsAt: '2026-10-14T11:00:00Z',
    durationMinutes: 60,
    status: 'live',
    joinUrl: 'https://example.com/demo-join-link',
  },
  {
    title: 'Tajweed practice (demo)',
    courseName: 'Quranic Studies',
    startsAt: '2026-10-16T05:30:00Z',
    durationMinutes: 45,
    status: 'scheduled',
  },
  { title: 'Live but no join link yet (demo)', status: 'live' },
];

export const demoAssignments: AssignmentSummary[] = [
  {
    title: 'Worksheet: linear equations (demo)',
    courseName: 'Class 9–10 · Mathematics',
    dueAt: '2026-10-20T12:30:00Z',
    status: 'pending',
    action: { href: '#assignments', label: 'Open assignment' },
  },
  {
    title: 'Essay draft (demo)',
    courseName: 'English Language',
    status: 'overdue',
    dueAt: '2026-10-10T12:30:00Z',
  },
  { title: 'Vocabulary quiz (demo)', status: 'graded', resultLabel: 'Result (demo)' },
];

export const demoExams: ExamSummary[] = [
  {
    title: 'Term test (demo)',
    courseName: 'Class 9–10 · Mathematics',
    scheduledAt: '2026-11-02T04:30:00Z',
    durationMinutes: 90,
    status: 'scheduled',
    action: { href: '#exams', label: 'View details' },
  },
  { title: 'Practice test (demo)', status: 'open', action: { href: '#exams', label: 'Start' } },
  { title: 'Invalid date is hidden (demo)', scheduledAt: 'not-a-date', status: 'completed' },
];

export const demoProgress: ProgressSummary[] = [
  { title: 'Mathematics (demo)', value: 12, max: 20, detail: '12 of 20 lessons (demo)' },
  { title: 'Arabic (demo)', value: 20, max: 20, detail: '20 of 20 lessons (demo)' },
  { title: 'No data yet (demo)', value: null },
  { title: 'Out-of-range 150 clamps to 100% (demo)', value: 150 },
];

export const demoTableRows = [
  { id: 'demo-1', name: 'Demo Student A', course: 'Class 9–10 · Mathematics', status: 'Active' },
  { id: 'demo-2', name: 'Demo Student B', course: 'English Language', status: 'Pending' },
  { id: 'demo-3', name: 'Demo Student C', course: 'Quranic Studies', status: 'Active' },
] as const;

/** Demo portal navigation — illustrative only; real portal IA is defined in later phases. */
export const demoStudentNav: NavGroup[] = [
  {
    items: [
      {
        label: 'Overview',
        href: '/design-system/dashboard-preview',
        icon: <LayoutDashboard />,
        exact: true,
      },
      {
        label: 'My courses',
        href: '/design-system/dashboard-preview/courses',
        icon: <GraduationCap />,
      },
      {
        label: 'Live classes',
        href: '/design-system/dashboard-preview/live',
        icon: <Video />,
        badge: '1',
      },
    ],
  },
  {
    label: 'Learning',
    items: [
      {
        label: 'Assignments',
        href: '/design-system/dashboard-preview/assignments',
        icon: <ClipboardList />,
      },
      { label: 'Exams', href: '/design-system/dashboard-preview/exams', icon: <BookOpenCheck /> },
      {
        label: 'Recorded lectures',
        href: '/design-system/dashboard-preview/recorded',
        icon: <MonitorPlay />,
      },
    ],
  },
];

export const demoAdminNav: NavGroup[] = [
  {
    items: [
      {
        label: 'Overview',
        href: '/design-system/admin-preview',
        icon: <LayoutDashboard />,
        exact: true,
      },
    ],
  },
  {
    label: 'Academy',
    items: [
      { label: 'Students', href: '/design-system/admin-preview/students', icon: <Users /> },
      { label: 'Courses', href: '/design-system/admin-preview/courses', icon: <GraduationCap /> },
      { label: 'Schedule', href: '/design-system/admin-preview/schedule', icon: <CalendarDays /> },
    ],
  },
  {
    label: 'System',
    items: [
      { label: 'Reports', href: '/design-system/admin-preview/reports', icon: <LineChart /> },
      { label: 'Roles', href: '/design-system/admin-preview/roles', icon: <ShieldCheck /> },
      { label: 'Settings', href: '/design-system/admin-preview/settings', icon: <Settings /> },
    ],
  },
];

export const demoFeatures = [
  {
    title: 'Live & recorded classes',
    description: 'Placeholder feature description (demo).',
    icon: <MonitorPlay />,
  },
  {
    title: 'CBSE pattern curriculum',
    description: 'Placeholder feature description (demo).',
    icon: <BookText />,
  },
  {
    title: 'Doubt-solving support',
    description: 'Placeholder feature description (demo).',
    icon: <Headphones />,
  },
];
