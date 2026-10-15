import { Compass, GraduationCap, MessageSquareText, UserPlus } from 'lucide-react';

/**
 * How a visitor becomes a student — used on the homepage and the admission page.
 *
 * PROVISIONAL: built only from what exists or is confirmed (public enquiry, self-registration from
 * PHASE 03, enrolment by the academy). Whether admission is automatic or approved, and whether
 * payment is involved, is pending (CLIENT-CLARIFICATIONS D-04, M-01, Y-02).
 */
export const LEARNING_STEPS = [
  {
    icon: <Compass />,
    title: 'Explore programmes',
    description: 'Browse school classes and special courses to find the right fit.',
  },
  {
    icon: <MessageSquareText />,
    title: 'Talk to us',
    description: 'Send an enquiry to ask about availability, timings and fees.',
  },
  {
    icon: <UserPlus />,
    title: 'Create your account',
    description: 'Register as a student on the ASRA Academy platform.',
  },
  {
    icon: <GraduationCap />,
    title: 'Enrol and start learning',
    description: 'Complete enrolment with the academy, then learn through classes and materials.',
  },
];

export function LearningSteps({ headingLevel = 'h3' }: { headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <ol className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {LEARNING_STEPS.map((step, index) => (
        <li
          key={step.title}
          className="relative flex flex-col gap-3 rounded-xl border bg-card p-5 shadow-card"
        >
          <div className="flex items-center justify-between">
            <span
              aria-hidden
              className="flex size-11 items-center justify-center rounded-lg bg-secondary text-asra-green-700 [&_svg]:size-5"
            >
              {step.icon}
            </span>
            <span aria-hidden className="font-display text-3xl font-bold text-asra-gold-200">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>
          <Heading className="type-h4 text-heading">
            <span className="sr-only">Step {index + 1}: </span>
            {step.title}
          </Heading>
          <p className="type-body-sm text-muted-foreground">{step.description}</p>
        </li>
      ))}
    </ol>
  );
}
