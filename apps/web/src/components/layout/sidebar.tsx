'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { isActivePath, type NavGroup } from '@/lib/navigation';
import { cn } from '@/lib/utils';

type SidebarProps = {
  groups: NavGroup[];
  /** Accessible name of the navigation landmark, e.g. "Student portal". */
  label: string;
  /** `admin` renders on the deep-green surface used by AdminLayout. */
  tone?: 'default' | 'admin';
  className?: string;
};

/**
 * Sidebar navigation for dashboards. Purely navigational: hiding an item here is NOT access
 * control — routes and APIs are protected by the auth/RBAC layer (docs/AUTHENTICATION.md).
 */
export function Sidebar({ groups, label, tone = 'default', className }: SidebarProps) {
  const pathname = usePathname();
  const admin = tone === 'admin';

  return (
    <nav aria-label={label} data-slot="sidebar" className={cn('grid gap-6', className)}>
      {groups.map((group, index) => (
        <div key={group.label ?? index} className="grid gap-1">
          {group.label ? (
            <h2
              className={cn(
                'px-3 pb-1 type-eyebrow',
                admin ? 'text-asra-gold-500' : 'text-muted-foreground',
              )}
            >
              {group.label}
            </h2>
          ) : null}
          <ul className="grid gap-0.5">
            {group.items.map((item) => {
              const active = isActivePath(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'group/item relative flex min-h-control items-center gap-3 rounded-lg px-3 type-label transition-colors outline-none focus-visible:ring-[3px] [&_svg]:size-[1.125rem] [&_svg]:shrink-0',
                      admin
                        ? 'text-asra-green-100 hover:bg-asra-green-800 hover:text-asra-ivory focus-visible:ring-asra-gold-500/60'
                        : 'text-foreground hover:bg-secondary focus-visible:ring-ring/50',
                      active &&
                        (admin
                          ? 'bg-asra-green-700 text-asra-ivory before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-asra-gold-500'
                          : 'bg-secondary text-primary before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-full before:bg-asra-gold-500'),
                    )}
                  >
                    {item.icon ? (
                      <span
                        aria-hidden
                        className={cn(
                          'flex',
                          admin ? 'text-asra-green-200' : 'text-asra-sage-strong',
                          active && (admin ? 'text-asra-gold-500' : 'text-primary'),
                        )}
                      >
                        {item.icon}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {item.badge ? (
                      <span
                        className={cn(
                          'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                          admin
                            ? 'bg-asra-gold-500 text-asra-green-950'
                            : 'bg-asra-gold-100 text-asra-gold-800',
                        )}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
