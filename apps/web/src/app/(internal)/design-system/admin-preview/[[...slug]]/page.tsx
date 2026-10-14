import { Plus } from 'lucide-react';
import { notFound } from 'next/navigation';

import { PageHeader } from '@/components/layout/page-header';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

import { TableDemo } from '../../_demos/data-demo';

const PAGES = {
  '': 'Overview',
  students: 'Students',
  courses: 'Courses',
  schedule: 'Schedule',
  reports: 'Reports',
  roles: 'Roles',
  settings: 'Settings',
} as const;

type PageKey = keyof typeof PAGES;

export default async function AdminPreviewPage({
  params,
}: PageProps<'/design-system/admin-preview/[[...slug]]'>) {
  const { slug } = await params;
  const key = (slug?.join('/') ?? '') as PageKey;
  if (!Object.hasOwn(PAGES, key)) notFound();
  const title = PAGES[key];

  return (
    <>
      <PageHeader
        title={title}
        description="AdminLayout preview with demo data — no administration features are implemented."
        breadcrumbs={[
          { label: 'Design system', href: '/design-system' },
          ...(key ? [{ label: 'Admin preview', href: '/design-system/admin-preview' }] : []),
          { label: title },
        ]}
        actions={
          <Button disabled>
            <Plus aria-hidden /> Add (demo)
          </Button>
        }
      />
      <Alert tone="warning" title="Navigation is not access control">
        <p>
          Admin routes must be protected server-side by the auth/RBAC layer. Hiding sidebar items
          only tidies the interface.
        </p>
      </Alert>
      <TableDemo />
    </>
  );
}
