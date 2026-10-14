import type { NavItem } from '@/lib/navigation';

/**
 * Public website navigation, from the documented page list (REQUIREMENTS REQ-PUB-001…015 and the
 * Phase 05 route plan). These pages are built in PHASE 05 — until then, only the design-system
 * showcase renders this navigation.
 */
export const publicNavigation: NavItem[] = [
  { label: 'Home', href: '/', exact: true },
  { label: 'About', href: '/about' },
  { label: 'Courses', href: '/courses' },
  { label: 'Faculty', href: '/faculty' },
  { label: 'Admission', href: '/admission' },
  { label: 'Contact', href: '/contact' },
];

export const footerNavigation: { title: string; links: NavItem[] }[] = [
  {
    title: 'Learn',
    links: [
      { label: 'Classes 6–10', href: '/classes/6-10' },
      { label: 'Classes 11–12', href: '/classes/11-12' },
      { label: 'English Language', href: '/courses/english' },
      { label: 'Entrepreneurship & Business', href: '/courses/entrepreneurship' },
      { label: 'Quranic Studies', href: '/courses/quranic-studies' },
      { label: 'Arabic', href: '/courses/arabic' },
      { label: 'Urdu', href: '/courses/urdu' },
    ],
  },
  {
    title: 'Academy',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Faculty', href: '/faculty' },
      { label: 'Admission', href: '/admission' },
      { label: 'Contact', href: '/contact' },
    ],
  },
];

/** Legal pages are mandatory (REQ-PUB-013…015); their text is pending from the client (U-01). */
export const legalNavigation: NavItem[] = [
  { label: 'Privacy Policy', href: '/privacy-policy' },
  { label: 'Terms and Conditions', href: '/terms' },
  { label: 'Refund Policy', href: '/refund-policy' },
];
