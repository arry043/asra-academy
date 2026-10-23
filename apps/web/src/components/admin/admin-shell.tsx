'use client';

import { PERMISSIONS } from '@asra/types';
import {
  BarChart3,
  Bell,
  BookOpen,
  ClipboardList,
  CreditCard,
  FolderTree,
  GraduationCap,
  History,
  KeyRound,
  Layers,
  LayoutDashboard,
  Loader2,
  LogOut,
  Mail,
  MonitorPlay,
  School,
  ShieldAlert,
  ShieldCheck,
  Shapes,
  Split,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import * as React from 'react';

import { useAuth } from '@/components/auth/auth-provider';
import { NotificationBell } from '@/components/notifications/notification-bell';
import { AdminLayout } from '@/components/layout/admin-layout';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import type { NavGroup, NavItem } from '@/lib/navigation';

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
          <NotificationBell />
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

/**
 * Admin navigation (PHASE 12, docs/ADMIN-DASHBOARD.md §2). Each item appears only with the
 * permission its API requires — a convenience, not a security boundary. Modules that do not exist
 * yet (certificates, coupons, announcements, enquiries, blog) are not listed; see
 * docs/CLIENT-CLARIFICATIONS.md AF.
 */
export function buildNavigation(can: (permission: string) => boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      items: [
        { label: 'Dashboard', href: '/admin', icon: <LayoutDashboard />, exact: true },
        ...(can(PERMISSIONS.ANALYTICS_VIEW)
          ? [{ label: 'Analytics', href: '/admin/analytics', icon: <BarChart3 /> }]
          : []),
      ],
    },
  ];
  const push = (label: string, items: (NavItem | false)[]) => {
    const visible = items.filter((item): item is NavItem => item !== false);
    if (visible.length > 0) groups.push({ label, items: visible });
  };
  push('Users', [
    can(PERMISSIONS.STUDENTS_MANAGE) && {
      label: 'Students',
      href: '/admin/students',
      icon: <GraduationCap />,
    },
    can(PERMISSIONS.FACULTY_MANAGE) && {
      label: 'Faculty',
      href: '/admin/faculty',
      icon: <UserRoundCheck />,
    },
    can(PERMISSIONS.ADMINS_MANAGE) && {
      label: 'Administrators',
      href: '/admin/admins',
      icon: <ShieldCheck />,
    },
  ]);
  push('Academic', [
    can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE) && {
      label: 'Academic levels',
      href: '/admin/academic-levels',
      icon: <Layers />,
    },
    can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE) && {
      label: 'Classes',
      href: '/admin/classes',
      icon: <School />,
    },
    can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE) && {
      label: 'Streams',
      href: '/admin/streams',
      icon: <Split />,
    },
    can(PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE) && {
      label: 'Subjects',
      href: '/admin/subjects',
      icon: <FolderTree />,
    },
  ]);
  push('Courses', [
    can(PERMISSIONS.COURSES_MANAGE) && {
      label: 'Courses',
      href: '/admin/courses',
      icon: <BookOpen />,
    },
    can(PERMISSIONS.COURSES_MANAGE) && {
      label: 'Categories',
      href: '/admin/course-categories',
      icon: <Shapes />,
    },
  ]);
  push('Learning', [
    can(PERMISSIONS.LIVE_CLASSES_MANAGE) && {
      label: 'Live classes',
      href: '/admin/live-classes',
      icon: <MonitorPlay />,
    },
    can(PERMISSIONS.CONTENT_MANAGE) && {
      label: 'Assessments',
      href: '/admin/assessments',
      icon: <ClipboardList />,
    },
  ]);
  push('Commerce', [
    can(PERMISSIONS.PAYMENTS_VIEW) && {
      label: 'Orders & payments',
      href: '/admin/payments',
      icon: <CreditCard />,
    },
    can(PERMISSIONS.ENROLLMENTS_MANAGE) && {
      label: 'Enrolments',
      href: '/admin/enrollments',
      icon: <Users />,
    },
  ]);
  push('Communication', [
    { label: 'My notifications', href: '/admin/notifications', icon: <Bell /> },
    can(PERMISSIONS.NOTIFICATIONS_VIEW) && {
      label: 'Email delivery',
      href: '/admin/email-deliveries',
      icon: <Mail />,
    },
  ]);
  push('Settings', [
    can(PERMISSIONS.ROLES_MANAGE) && {
      label: 'Roles & permissions',
      href: '/admin/roles',
      icon: <KeyRound />,
    },
    can(PERMISSIONS.AUDIT_LOGS_VIEW) && {
      label: 'Audit logs',
      href: '/admin/audit-logs',
      icon: <History />,
    },
  ]);
  return groups;
}
