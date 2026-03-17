'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationItems, type AppRole, type NavigationItem } from '@/config/navigation.config';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils/cn';

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name: NavigationItem['icon'];
  className?: string;
}) {
  const common = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect {...common} x="4" y="4" width="6" height="6" />
          <rect {...common} x="14" y="4" width="6" height="6" />
          <rect {...common} x="4" y="14" width="6" height="6" />
          <rect {...common} x="14" y="14" width="6" height="6" />
        </svg>
      );

    case 'requests':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M9 4h6l1 2h3v14H5V6h3l1-2Z" />
          <path {...common} d="M9 10h6M9 14h6" />
        </svg>
      );

    case 'returns':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M8 7H4v4" />
          <path {...common} d="M4 11a8 8 0 1 0 2-5.3L8 7" />
        </svg>
      );

    case 'custody':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M9 7V5h6v2" />
          <path {...common} d="M4 8h16v10H4z" />
          <path {...common} d="M4 12h16" />
        </svg>
      );

    case 'inventory':
    case 'archive':
    case 'purchases':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
          <path {...common} d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
        </svg>
      );

    case 'approvals':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M7 12.5 10 15l7-7" />
          <rect {...common} x="4" y="4" width="16" height="16" rx="2" />
        </svg>
      );

    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path {...common} d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );

    case 'audit':
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M7 4h7l5 5v11H7z" />
          <path {...common} d="M14 4v5h5M10 13h4M10 17h6" />
        </svg>
      );

    case 'messages':
    case 'email':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect {...common} x="3" y="5" width="18" height="14" rx="2" />
          <path {...common} d="m4 7 8 6 8-6" />
        </svg>
      );

    case 'users':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M16 19a4 4 0 0 0-8 0" />
          <circle {...common} cx="12" cy="11" r="3" />
          <path {...common} d="M19 19a3 3 0 0 0-3-3M18 10a2.5 2.5 0 1 0-2.5-2.5" />
        </svg>
      );

    case 'maintenance':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="m14.7 6.3 3 3-8.4 8.4H6.3v-3L14.7 6.3Z" />
          <path {...common} d="m13.3 7.7 3 3" />
        </svg>
      );

    case 'suggestions':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M12 3a7 7 0 0 0-4 12.8V18a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.2A7 7 0 0 0 12 3Z" />
          <path {...common} d="M10 21h4" />
        </svg>
      );

    default:
      return null;
  }
}

const groupLabels: Record<NavigationItem['group'], string> = {
  main: 'الرئيسية',
  operations: 'التشغيل اليومي',
  governance: 'الحوكمة والرقابة',
  management: 'الإدارة والتواصل',
};

export function Sidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = ((user?.role || 'user') as AppRole);

  const items = navigationItems.filter((item) => !item.roles || item.roles.includes(role));

  const groups = ['main', 'operations', 'governance', 'management'] as const;

  return (
    <aside className="w-full border-b border-[#dbe6e4] bg-white lg:min-h-screen lg:w-80 lg:border-b-0 lg:border-l">
      <div className="border-b border-[#dbe6e4] bg-[linear-gradient(135deg,#016564_0%,#0b6d6b_100%)] px-6 py-6 text-white">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[11px]">
          منصة إدارة مخزون المواد التدريبية
        </div>
        <h2 className="mt-4 text-[22px] leading-[1.2]">وكالة التدريب</h2>
        <p className="mt-2 text-[12px] leading-6 text-white/80">
          {role === 'manager' ? 'وضع المدير' : role === 'warehouse' ? 'وضع مسؤول المخزن' : 'وضع الموظف'}
        </p>
      </div>

      <nav className="space-y-6 p-4">
        {groups.map((group) => {
          const groupItems = items.filter((item) => item.group === group);
          if (groupItems.length === 0) return null;

          return (
            <div key={group}>
              <div className="mb-2 px-2 text-[11px] font-semibold tracking-wide text-slate-400">
                {groupLabels[group]}
              </div>

              <div className="space-y-1.5">
                {groupItems.map((item) => {
                  const active = pathname === item.href;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition',
                        active
                          ? 'bg-[#016564] text-white shadow-[0_10px_25px_rgba(1,101,100,0.18)]'
                          : 'text-slate-700 hover:bg-[#f5f9f8] hover:text-[#016564]'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-2xl transition',
                          active
                            ? 'bg-white/10 text-white'
                            : 'bg-[#016564]/8 text-[#016564] group-hover:bg-[#016564]/12'
                        )}
                      >
                        <Icon name={item.icon} className="h-5 w-5" />
                      </span>

                      <span className="flex-1">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}