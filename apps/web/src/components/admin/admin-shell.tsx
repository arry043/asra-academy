'use client';

import { PERMISSIONS } from '@asra/types';
import {
  BookOpen,
  CreditCard,
  FolderTree,
  GraduationCap,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  ShieldAlert,
  Shapes,
  Split,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { NavGroup } from '@/lib/navigation';

import { canUseAdminPortal, hasPermission } from './use-admin';

/**
 * Session gate + shell for `/admin/*`. This decides what the UI shows; it is NOT the security
 * boundary — every `/api/v1/admin/*` endpoint re-checks authentication, permissions and
 * resource access on the server.
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const { status, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (status === 'anonymous') {
      router.replace(`/login?next=${encodeURIComponent(pathname ?? '/admin')}`);
    }
  }, [status, router, pathname]);

  if (status !== 'authenticated' || !user) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <p role="status" className="flex items-center gap-2 type-body text-muted-foreground">
          <Loader2 className="size-4 animate-spin" aria-hidden />
          {status === 'loading' ? 'Checking your session…' : 'Redirecting to sign in…'}
        </p>
      </main>
    );
  }

  if (!canUseAdminPortal(user)) {
    return (
      <main className="flex min-h-dvh items-center justify-center p-6">
        <div className="grid max-w-md justify-items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-card">
          <ShieldAlert className="size-10 text-destructive" aria-hidden />
          <h1 className="type-h2 text-heading">No access to administration</h1>
          <p className="type-body text-muted-foreground">
            You are signed in as {user.email}, which does not have administration permissions.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button asChild variant="outline">
              <Link href="/">Go to the website</Link>
            </Button>
            <Button onClick={() => void logout()}>Sign out</Button>
          </div>
        </div>
      </main>
    );
  }

  const navigation = buildNavigation((permission) => hasPermission(user, permission));

  return (
    <AdminLayout
      navigation={navigation}
      brandHref="/admin"
      headerActions={
        <>
          <span className="hidden text-right sm:grid">
            <span className="type-label text-heading">{user.fullName}</span>
            <span className="type-caption text-muted-foreground">{user.roles.join(', ')}</span>
          </span>
          <Avatar name={user.fullName} size="sm" />
          <Button variant="ghost" size="icon" aria-label="Sign out" onClick={() => void logout()}>
            <LogOut className="size-5" aria-hidden />
          </Button>
        </>
      }
    >
      {children}
    </AdminLayout>
  );
}

function buildNavigation(can: (permission: string) => boolean): NavGroup[] {
  const groups: NavGroup[] = [
    { items: [{ label: 'Overview', href: '/admin', icon: <LayoutDashboard />, exact: true }] },
  ];
  if (can(PERMISSIONS.COURSES_MANAGE)) {
    groups.push({
      label: 'Courses',
      items: [
        { label: 'Courses', href: '/admin/courses', icon: <BookOpen /> },
        { label: 'Course categories', href: '/admin/course-categories', icon: <Shapes /> },
      ],
    });
  }
  if (can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE)) {
    groups.push({
      label: 'Academic structure',
      items: [
        { label: 'Academic levels', href: '/admin/academic-levels', icon: <Layers /> },
        { label: 'Classes', href: '/admin/classes', icon: <GraduationCap /> },
        { label: 'Streams', href: '/admin/streams', icon: <Split /> },
        { label: 'Subjects', href: '/admin/subjects', icon: <FolderTree /> },
      ],
    });
  }
  if (can(PERMISSIONS.PAYMENTS_VIEW)) {
    groups.push({
      label: 'Finance',
      items: [{ label: 'Payments', href: '/admin/payments', icon: <CreditCard /> }],
    });
  }
  return groups;
}
