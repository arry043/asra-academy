/**
 * Public programme catalogue — the data source for the course directory, the class pages and the
 * special-course pages.
 *
 * SOURCE: the client's Project Development Order §2A (school education) and §2B (special courses),
 * as recorded in docs/PRD.md §5. Every summary and topic below restates that document; nothing
 * else (fees, durations, batches, levels, schedules, faculty, certificates) is confirmed, so none
 * of it appears here (CLIENT-CLARIFICATIONS A-01, A-02, B-01–B-04).
 *
 * WHY STATIC: the API has no public catalogue endpoint yet (PHASE 06 builds course management on
 * the existing Prisma `Course` model). When it exists, replace `programmes` with an API call that
 * returns the same `Programme` shape — the pages only depend on this type, not on this file.
 */

export type ProgrammeCategory = 'school' | 'language' | 'business' | 'quranic';

export type ProgrammeKind = 'class-band' | 'special-course';

export interface Programme {
  /** URL segment and enquiry topic key (`@asra/validation` ENQUIRY_TOPICS). */
  slug: string;
  kind: ProgrammeKind;
  href: string;
  title: string;
  category: ProgrammeCategory;
  /** One sentence for cards and meta descriptions. */
  summary: string;
  /** Short paragraphs for the programme page introduction. */
  description: string[];
  /** Content areas stated by the client for this programme. */
  topics: string[];
  /** Heading shown above `topics`. */
  topicsHeading: string;
  /** Curriculum label, only where confirmed (Classes 6–10: CBSE pattern, REQ-ACA-002). */
  curriculum?: string;
  /**
   * Subjects the client has said MAY be offered. The final list depends on class, stream and
   * faculty availability (A-01, A-02), so pages must label these as provisional.
   */
  candidateSubjects?: string[];
  /** Search-engine title and description (unique per page). */
  seo: { title: string; description: string };
}

export const PROGRAMME_CATEGORIES: Record<ProgrammeCategory, string> = {
  school: 'School education',
  language: 'Languages',
  business: 'Entrepreneurship & Business',
  quranic: 'Quranic Studies',
};

/** Learning components stated for school education (Order §2A). */
const SCHOOL_LEARNING = [
  'Chapter-wise lectures',
  'Notes and study materials',
  'Assignments',
  'Practice questions',
  'Examinations',
];

export const programmes: Programme[] = [
  {
    slug: 'classes-6-10',
    kind: 'class-band',
    href: '/classes/6-10',
    title: 'Classes 6–10',
    category: 'school',
    curriculum: 'CBSE pattern',
    summary:
      'CBSE-pattern school education with chapter-wise lectures, notes, assignments, practice questions and examinations.',
    description: [
      'ASRA Academy supports school students in Classes 6 to 10 who follow the CBSE-pattern curriculum.',
      'Learning is organised chapter by chapter, combining lectures, notes, assignments, practice questions and examinations.',
    ],
    topicsHeading: 'How learning is organised',
    topics: SCHOOL_LEARNING,
    candidateSubjects: [
      'Mathematics',
      'Science',
      'English',
      'Hindi',
      'Urdu',
      'Arabic',
      'Social Science',
    ],
    seo: {
      title: 'Classes 6–10 (CBSE pattern)',
      description:
        'Online school education for Classes 6–10 following the CBSE pattern: chapter-wise lectures, notes, assignments, practice questions and examinations at ASRA Academy.',
    },
  },
  {
    slug: 'classes-11-12',
    kind: 'class-band',
    href: '/classes/11-12',
    title: 'Classes 11–12',
    category: 'school',
    summary:
      'Subject-specific coaching for the applicable academic streams, with chapter-wise lectures, notes, assignments, practice questions and examinations.',
    description: [
      'For Classes 11 and 12, ASRA Academy offers subject-specific coaching for the applicable academic streams.',
      'As in the younger classes, each subject is organised chapter by chapter with lectures, notes, assignments, practice questions and examinations.',
    ],
    topicsHeading: 'How learning is organised',
    topics: SCHOOL_LEARNING,
    candidateSubjects: ['Physics', 'Chemistry', 'Mathematics', 'Biology', 'English'],
    seo: {
      title: 'Classes 11–12 subject coaching',
      description:
        'Subject-specific coaching for Classes 11–12 at ASRA Academy, with chapter-wise lectures, notes, assignments, practice questions and examinations.',
    },
  },
  {
    slug: 'english',
    kind: 'special-course',
    href: '/courses/english',
    title: 'English Language',
    category: 'language',
    summary: 'Spoken English, grammar, vocabulary, communication skills and writing.',
    description: [
      'The English Language course helps learners build confidence in using English, from everyday speaking to clear writing.',
      'It covers spoken English, grammar, vocabulary, communication skills and writing.',
    ],
    topicsHeading: 'What the course covers',
    topics: ['Spoken English', 'Grammar', 'Vocabulary', 'Communication skills', 'Writing'],
    seo: {
      title: 'English Language course',
      description:
        'Learn spoken English, grammar, vocabulary, communication skills and writing with the English Language course at ASRA Academy.',
    },
  },
  {
    slug: 'entrepreneurship',
    kind: 'special-course',
    href: '/courses/entrepreneurship',
    title: 'Entrepreneurship & Business',
    category: 'business',
    summary:
      'Startup fundamentals, business planning, marketing, finance basics and business management.',
    description: [
      'The Entrepreneurship & Business course introduces the foundations of starting and running a business.',
      'It covers startup fundamentals, business planning, marketing, finance basics and business management.',
    ],
    topicsHeading: 'What the course covers',
    topics: [
      'Startup fundamentals',
      'Business planning',
      'Marketing',
      'Finance basics',
      'Business management',
    ],
    seo: {
      title: 'Entrepreneurship & Business course',
      description:
        'Startup fundamentals, business planning, marketing, finance basics and business management — the Entrepreneurship & Business course at ASRA Academy.',
    },
  },
  {
    slug: 'quranic-studies',
    kind: 'special-course',
    href: '/courses/quranic-studies',
    title: 'Quranic Studies',
    category: 'quranic',
    summary:
      'Quran reading, Tajweed, understanding, and structured Islamic studies as determined by the academy.',
    description: [
      'The Quranic Studies course offers a structured path for learning to read and understand the Quran.',
      'It covers Quran reading, Tajweed and understanding, together with structured Islamic studies as determined by the academy.',
    ],
    topicsHeading: 'What the course covers',
    topics: ['Quran reading', 'Tajweed', 'Understanding the Quran', 'Structured Islamic studies'],
    seo: {
      title: 'Quranic Studies course',
      description:
        'Quran reading, Tajweed, understanding and structured Islamic studies — the Quranic Studies course at ASRA Academy.',
    },
  },
  {
    slug: 'arabic',
    kind: 'special-course',
    href: '/courses/arabic',
    title: 'Arabic Language',
    category: 'language',
    summary: 'Reading, writing, grammar and communication in Arabic.',
    description: [
      'The Arabic Language course develops the core skills needed to read, write and communicate in Arabic.',
      'It covers reading, writing, grammar and communication.',
    ],
    topicsHeading: 'What the course covers',
    topics: ['Reading', 'Writing', 'Grammar', 'Communication'],
    seo: {
      title: 'Arabic Language course',
      description:
        'Learn Arabic reading, writing, grammar and communication with the Arabic Language course at ASRA Academy.',
    },
  },
  {
    slug: 'urdu',
    kind: 'special-course',
    href: '/courses/urdu',
    title: 'Urdu Language',
    category: 'language',
    summary: 'Reading, writing, grammar and literature in Urdu.',
    description: [
      'The Urdu Language course builds reading and writing skills in Urdu and an appreciation of its literature.',
      'It covers reading, writing, grammar and literature.',
    ],
    topicsHeading: 'What the course covers',
    topics: ['Reading', 'Writing', 'Grammar', 'Literature'],
    seo: {
      title: 'Urdu Language course',
      description:
        'Learn Urdu reading, writing, grammar and literature with the Urdu Language course at ASRA Academy.',
    },
  },
];
