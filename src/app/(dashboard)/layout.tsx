'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { NotificationBell } from '@/components/layout/NotificationBell';

type AppRole = 'manager' | 'warehouse' | 'user';

type NavItem = {
  href: string;
  label: string;
  roles?: AppRole[];
  icon: React.ReactNode;
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

const iconClass = 'h-5 w-5';

const managerWarehouseGroups: NavGroup[] = [
  {
    title: 'التشغيل',
    items: [
      {
        href: '/dashboard',
        label: 'لوحة التحكم',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M4 13h7V4H4v9Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 20h7v-5h-7v5Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 11h7V4h-7v7Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 20h7v-5H4v5Z" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/inventory',
        label: 'المخزون',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/requests',
        label: 'الطلبات التشغيلية',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M7 4h7l3 3v13H7V4Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10 12h4M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: '/returns',
        label: 'الإرجاعات التشغيلية',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M8 8H5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 8c1.8-2.4 4-3.5 7-3.5 4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'الخدمات',
    items: [
      {
        href: '/maintenance',
        label: 'الصيانة والنظافة',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="m14 7 3-3 3 3-3 3-3-3Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 8 6 15a2.12 2.12 0 1 0 3 3l7-7" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/purchases',
        label: 'تذاكر الشراء',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M6 7h13l-1.2 6.2a2 2 0 0 1-2 1.6H9.3a2 2 0 0 1-2-1.6L6 7Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M6 7 5.2 5.3A1.5 1.5 0 0 0 3.8 4.5H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="10" cy="18.5" r="1.2" fill="currentColor" />
            <circle cx="17" cy="18.5" r="1.2" fill="currentColor" />
          </svg>
        ),
      },
      {
        href: '/messages',
        label: 'المراسلات الداخلية',
        roles: ['manager', 'warehouse', 'user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.5A2.5 2.5 0 0 1 5 13.5v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: '/email-drafts',
        label: 'المراسلات الخارجية',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M4 7.5C4 6.67 4.67 6 5.5 6h13c.83 0 1.5.67 1.5 1.5v9c0 .83-.67 1.5-1.5 1.5h-13c-.83 0-1.5-.67-1.5-1.5v-9Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="m5 8 7 5 7-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: '/notifications',
        label: 'الإشعارات',
        roles: ['manager', 'warehouse', 'user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M6 16.5h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v4.5l-1.5 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'الحوكمة',
    items: [
      {
        href: '/reports',
        label: 'التقارير',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M7 18V10M12 18V6M17 18v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M5 20h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: '/archive',
        label: 'الأرشيف',
        roles: ['manager', 'warehouse'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M5 7h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 4h16v3H4V4ZM10 11h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: '/audit-logs',
        label: 'سجل التدقيق',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/users',
        label: 'المستخدمون',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M5 19c1.5-2.8 4-4.2 7-4.2S17.5 16.2 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
];

const employeeGroups: NavGroup[] = [
  {
    title: 'خدماتي',
    items: [
      {
        href: '/dashboard',
        label: 'لوحة معلوماتي',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M4 13h7V4H4v9Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 20h7v-5h-7v5Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M13 11h7V4h-7v7Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 20h7v-5H4v5Z" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/requests',
        label: 'طلب مواد',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M7 4h7l3 3v13H7V4Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M10 12h4M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: '/custody',
        label: 'عهدتي',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/returns',
        label: 'طلبات الإرجاع',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M8 8H5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5 8c1.8-2.4 4-3.5 7-3.5 4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
      {
        href: '/messages',
        label: 'المراسلات الداخلية',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M5 7.5A2.5 2.5 0 0 1 7.5 5h9A2.5 2.5 0 0 1 19 7.5v6A2.5 2.5 0 0 1 16.5 16H10l-4 3v-3.5A2.5 2.5 0 0 1 5 13.5v-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
          </svg>
        ),
      },
      {
        href: '/notifications',
        label: 'الإشعارات',
        roles: ['user'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M6 16.5h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v4.5l-1.5 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        ),
      },
    ],
  },
];

function getNavGroups(role?: string): NavGroup[] {
  if (role === 'user') return employeeGroups;
  return managerWarehouseGroups;
}

function canAccess(item: NavItem, role?: string) {
  if (!item.roles || item.roles.length === 0) return true;
  return item.roles.includes((role as AppRole) || 'user');
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard') return pathname === '/dashboard';
  return pathname.startsWith(href);
}

function LogoutIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M14 7.5V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 12h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="m17 8 4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 19c1.5-2.8 4-4.2 7-4.2S17.5 16.2 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user, logout, switchViewRole, originalUser, canUseRoleSwitch } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleGroups = useMemo(() => {
    return getNavGroups(user?.role)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccess(item, user?.role)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user?.role]);

  const Sidebar = (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-5">
        <div className="rounded-[30px] border border-white/70 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-end">
            <img
              src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
              alt="شعار جامعة نايف"
              className="h-24 w-auto object-contain"
            />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-5">
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-2 text-xs tracking-[0.08em] text-slate-400">
                {group.title}
              </p>

              <div className="space-y-2">
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`group flex items-center gap-3 rounded-2xl px-3 py-3 transition ${
                        active
                          ? 'bg-[#016564] text-white shadow-soft'
                          : 'bg-white/88 text-slate-700 shadow-soft hover:bg-white hover:text-[#016564]'
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-2xl transition ${
                          active ? 'bg-white/10 text-white' : 'bg-[#016564]/7 text-[#016564]'
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span className="flex-1 text-sm">{item.label}</span>

                      <span
                        className={`h-2.5 w-2.5 rounded-full ${
                          active ? 'bg-[#d0b284]' : 'bg-slate-300'
                        }`}
                      />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="min-h-screen bg-surface text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[320px] shrink-0 border-l border-slate-200/80 bg-white/70 backdrop-blur xl:block">
          {Sidebar}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-50 xl:hidden">
            <div
              className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
            />
            <div className="absolute right-0 top-0 h-full w-[88%] max-w-[360px] border-l border-slate-200 bg-[#f7f9f9] shadow-soft-lg">
              {Sidebar}
            </div>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-6">
              <div className="flex items-center gap-4 text-right">
                <div>
                  <h1 className="text-[24px] font-semibold text-[#016564] lg:text-[28px]">
                    منصة إدارة مخزون المواد التدريبية
                  </h1>
                </div>
              </div>

              <div className="mr-auto flex items-center gap-3">
                {canUseRoleSwitch ? (
                  <div className="flex items-center rounded-full border border-slate-200 bg-[#f7f9f9] p-1 shadow-inner">
                    {originalUser?.role === 'manager' ? (
                      <>
                        <button
                          onClick={() => switchViewRole('manager')}
                          className={`rounded-full px-4 py-2 text-[13px] leading-none transition ${
                            user?.role === 'manager'
                              ? 'bg-[#016564] text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          مدير
                        </button>

                        <button
                          onClick={() => switchViewRole('user')}
                          className={`rounded-full px-4 py-2 text-[13px] leading-none transition ${
                            user?.role === 'user'
                              ? 'bg-[#016564] text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          موظف
                        </button>
                      </>
                    ) : null}

                    {originalUser?.role === 'warehouse' ? (
                      <>
                        <button
                          onClick={() => switchViewRole('warehouse')}
                          className={`rounded-full px-4 py-2 text-[13px] leading-none transition ${
                            user?.role === 'warehouse'
                              ? 'bg-[#016564] text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          مسؤول مخزن
                        </button>

                        <button
                          onClick={() => switchViewRole('user')}
                          className={`rounded-full px-4 py-2 text-[13px] leading-none transition ${
                            user?.role === 'user'
                              ? 'bg-[#016564] text-white shadow-sm'
                              : 'text-slate-600 hover:bg-white'
                          }`}
                        >
                          موظف
                        </button>
                      </>
                    ) : null}
                  </div>
                ) : null}

                {user?.id ? <NotificationBell userId={user.id} /> : null}

                <div className="flex items-center gap-3 rounded-[26px] border border-slate-200 bg-white px-3 py-2 shadow-soft">
                  <div className="text-right">
                    <p className="text-[15px] font-medium leading-6 text-slate-900">
                      {user?.fullName || 'مستخدم النظام'}
                    </p>
                    <p className="text-[12px] leading-5 text-slate-500">
                      {user?.email || ''}
                    </p>
                  </div>

                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#016564]/8 text-[#016564]">
                    <UserIcon />
                  </div>
                </div>

                <button
                  onClick={logout}
                  title="تسجيل الخروج"
                  aria-label="تسجيل الخروج"
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-soft transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                >
                  <LogoutIcon />
                </button>

                <button
                  onClick={() => setMobileOpen((prev) => !prev)}
                  className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#016564] shadow-soft xl:hidden"
                >
                  {mobileOpen ? (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  ) : (
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
                      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-4 lg:px-6 lg:py-6">
            <div className="mx-auto max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}