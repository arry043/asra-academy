import { PageTransition } from '@/components/layout/page-transition';

/** Re-mounts per navigation, so the page content fades in while the shell stays still. */
export default function DashboardPreviewTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition className="grid gap-6 lg:gap-8">{children}</PageTransition>;
}
