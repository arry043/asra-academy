import { PageTransition } from '@/components/layout/page-transition';

/** Re-mounts per navigation so each public page fades in; header and footer stay still. */
export default function PublicTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
