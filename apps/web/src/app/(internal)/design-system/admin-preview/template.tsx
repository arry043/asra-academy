import { PageTransition } from '@/components/layout/page-transition';

export default function AdminPreviewTemplate({ children }: { children: React.ReactNode }) {
  return <PageTransition className="grid gap-6 lg:gap-8">{children}</PageTransition>;
}
