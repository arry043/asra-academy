/**
 * PHASE 12 web: analytics formatting helpers, permission-aware admin navigation and the chart
 * components' static markup (empty states, labelled values). Interactive behaviour (hover
 * tooltips, dialogs) needs a browser; the data behind every figure is tested in the API suite
 * (apps/api/tests/admin-dashboard-phase12.test.ts).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { renderToStaticMarkup } from 'react-dom/server';

import { PERMISSIONS, type AuthUser } from '@asra/types';

import { buildNavigation } from '@/components/admin/admin-shell';
import { BarList, ColumnChart, TrendChart } from '@/components/admin/charts';
import { canUseAdminPortal } from '@/components/admin/use-admin';
import {
  auditActionLabel,
  compareCounts,
  formatPercent,
  niceMax,
  periodLabel,
  presetRange,
  rangeQuery,
  shiftDay,
  todayInAcademyZone,
} from '@/lib/admin/analytics';

const user = (permissions: string[]): AuthUser => ({
  id: 'u',
  email: 'a@example.test',
  fullName: 'A',
  emailVerified: true,
  roles: [],
  permissions,
});

describe('analytics helpers', () => {
  it('compares periods without inventing percentages', () => {
    assert.deepEqual(
      { ...compareCounts(5, 0, 'x'), description: undefined },
      { text: '+5', direction: 'up', description: undefined },
    );
    assert.equal(compareCounts(2, 5, 'x').text, '−3');
    assert.equal(compareCounts(4, 4, 'x').direction, 'flat');
    assert.equal(
      compareCounts(1_250, 3, 'registrations').description,
      '1,250 registrations vs 3 in the previous period',
    );
  });

  it('formats percentages and missing ratios', () => {
    assert.equal(formatPercent(null), '—');
    assert.equal(formatPercent(33), '33%');
    assert.equal(formatPercent(49.555, 1), '49.6%');
  });

  it('labels buckets by granularity', () => {
    assert.equal(periodLabel('2026-05-04', 'day'), '4 May');
    assert.equal(periodLabel('2026-05-04', 'week', true), 'Week of 4 May 2026');
    assert.equal(periodLabel('2026-05-01', 'month'), 'May 2026');
  });

  it('uses the academy calendar (IST) for "today" and presets', () => {
    assert.equal(todayInAcademyZone(new Date('2026-03-01T18:30:00Z')), '2026-03-02');
    assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
    assert.deepEqual(presetRange('7d', '2026-03-10'), {
      from: '2026-03-04',
      to: '2026-03-10',
      granularity: '',
    });
  });

  it('builds query strings and leaves server defaults alone', () => {
    assert.equal(rangeQuery({ from: '', to: '', granularity: '' }), '');
    assert.equal(
      rangeQuery(
        { from: '2026-01-01', to: '2026-01-31', granularity: 'week' },
        { q: 'math', page: 2, mode: '' },
      ),
      '?from=2026-01-01&to=2026-01-31&granularity=week&q=math&page=2',
    );
  });

  it('rounds axis maxima up to readable values', () => {
    assert.equal(niceMax(0), 1);
    assert.equal(niceMax(7), 8);
    assert.equal(niceMax(130), 150);
    assert.equal(niceMax(2_400), 2_500);
  });

  it('labels audit actions', () => {
    assert.equal(auditActionLabel('user.status_changed'), 'User status changed');
  });
});

describe('admin navigation', () => {
  const labels = (permissions: string[]) =>
    buildNavigation((p) => permissions.includes(p)).flatMap((group) =>
      group.items.map((item) => item.label),
    );

  it('shows only the modules the administrator may use', () => {
    const adminPermissions = [
      PERMISSIONS.STUDENTS_MANAGE,
      PERMISSIONS.FACULTY_MANAGE,
      PERMISSIONS.ACADEMIC_STRUCTURE_MANAGE,
      PERMISSIONS.COURSES_MANAGE,
      PERMISSIONS.CONTENT_MANAGE,
      PERMISSIONS.ENROLLMENTS_MANAGE,
      PERMISSIONS.LIVE_CLASSES_MANAGE,
      PERMISSIONS.PAYMENTS_VIEW,
      PERMISSIONS.ANALYTICS_VIEW,
      PERMISSIONS.NOTIFICATIONS_VIEW,
    ];
    const admin = labels(adminPermissions);
    for (const label of [
      'Dashboard',
      'Analytics',
      'Students',
      'Faculty',
      'Courses',
      'Assessments',
      'Orders & payments',
      'Enrolments',
      'Email delivery',
    ]) {
      assert.ok(admin.includes(label), label);
    }
    for (const label of ['Administrators', 'Roles & permissions', 'Audit logs']) {
      assert.ok(!admin.includes(label), `${label} hidden from ADMIN`);
    }
    assert.deepEqual(labels([PERMISSIONS.PAYMENTS_VIEW]), [
      'Dashboard',
      'Orders & payments',
      'My notifications',
    ]);
  });

  it('lets analysts and super-admin-only roles into the portal', () => {
    assert.equal(canUseAdminPortal(user([PERMISSIONS.ANALYTICS_VIEW])), true);
    assert.equal(canUseAdminPortal(user([PERMISSIONS.AUDIT_LOGS_VIEW])), true);
    assert.equal(canUseAdminPortal(user([PERMISSIONS.CONTENT_VIEW_ENROLLED])), false);
  });
});

describe('charts', () => {
  it('renders an explicit empty state instead of a flat chart', () => {
    const html = renderToStaticMarkup(
      <TrendChart
        title="Registrations"
        granularity="day"
        format={String}
        points={[{ period: '2026-05-01', value: 0 }]}
        emptyText="No students registered in this period."
      />,
    );
    assert.match(html, /No students registered in this period\./);
    assert.match(html, /Show table/);
  });

  it('labels every bar and column with its exact value', () => {
    const bars = renderToStaticMarkup(
      <BarList
        title="Courses"
        items={[{ key: 'a', label: 'Algebra', value: 12, note: '10 still active' }]}
      />,
    );
    assert.match(bars, /Algebra/);
    assert.match(bars, />12</);
    assert.match(bars, /10 still active/);
    const columns = renderToStaticMarkup(
      <ColumnChart
        title="Scores"
        columns={[
          { key: '0', label: '0–9', value: 3 },
          { key: '1', label: '10–19', value: 0 },
        ]}
      />,
    );
    assert.match(columns, /0–9: 3/);
    assert.match(renderToStaticMarkup(<BarList title="Empty" items={[]} />), /Nothing to compare/);
  });
});
