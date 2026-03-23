'use client';

import React, { useEffect, useMemo, useState } from 'react';
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

const iconClass = 'h-5 w-5 shrink-0';

const managerWarehouseGroups: NavGroup[] = [
  {
    title: 'لوحة التحكم',
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
    ],
  },
  {
    title: 'القسم الرئيسي',
    items: [
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
        label: 'الصيانة',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="m14.7 6.3 3 3-8.4 8.4H6.3v-3L14.7 6.3Z" stroke="currentColor" strokeWidth="1.8" />
            <path d="m13.3 7.7 3 3" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/cleaning',
        label: 'النظافة',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <path d="M7 21h10" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" />
            <path d="m8 7 4-4 4 4" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 15h8" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
      {
        href: '/purchases',
        label: 'الشراء المباشر',
        roles: ['manager'],
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
        href: '/other',
        label: 'الطلبات الأخرى',
        roles: ['manager'],
        icon: (
          <svg className={iconClass} viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
            <path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1.1-1.5 2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M12 17h.01" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        ),
      },
    ],
  },
  {
    title: 'المراسلات',
    items: [
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
        roles: ['manager'],
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
        roles: ['manager'],
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
  return pathname === href || pathname.startsWith(`${href}/`);
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

function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none">
      <path d="M6 6 18 18M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = originalOverflow || '';
    }

    return () => {
      document.body.style.overflow = originalOverflow || '';
    };
  }, [mobileOpen]);

  const visibleGroups = useMemo(() => {
    return getNavGroups(user?.role)
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => canAccess(item, user?.role)),
      }))
      .filter((group) => group.items.length > 0);
  }, [user?.role]);

  const sidebarContent = (
    <div className="flex h-full min-h-0 flex-col bg-[#f7f9f9]">
      <div className="shrink-0 px-4 pb-4 pt-4 sm:px-5 sm:pt-5">
        <div className="rounded-[26px] border border-white/70 bg-white/90 p-4 shadow-soft backdrop-blur">
          <div className="flex items-center justify-between gap-3 xl:justify-end">
            <div className="xl:hidden">
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="إغلاق القائمة"
                className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-soft"
              >
                <CloseIcon />
              </button>
            </div>

            <img
              src="https://nauss.edu.sa/Style%20Library/ar-sa/Styles/images/home/Logo.svg"
              alt="شعار جامعة نايف"
              className="h-16 w-auto object-contain sm:h-20 xl:h-24"
            />
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-4 sm:pb-5">
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.title}>
              <p className="mb-3 px-2 text-[11px] tracking-[0.08em] text-slate-400 sm:text-xs">
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
                      className={`group flex min-h-[56px] items-center gap-3 rounded-2xl px-3 py-3 transition ${
                        active
                          ? 'bg-[#016564] text-white shadow-soft'
                          : 'bg-white/90 text-slate-700 shadow-soft hover:bg-white hover:text-[#016564]'
                      }`}
                    >
                      <span
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                          active ? 'bg-white/10 text-white' : 'bg-[#016564]/7 text-[#016564]'
                        }`}
                      >
                        {item.icon}
                      </span>

                      <span className="min-w-0 flex-1 text-sm leading-6">{item.label}</span>

                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
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
    <div dir="rtl" className="min-h-screen overflow-x-clip bg-surface text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-[320px] shrink-0 border-l border-slate-200/80 bg-white/70 backdrop-blur xl:block">
          {sidebarContent}
        </aside>

        {mobileOpen ? (
          <div className="fixed inset-0 z-[70] xl:hidden">
            <button
              aria-label="إغلاق القائمة"
              className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="absolute right-0 top-0 h-[100dvh] w-[calc(100%-2rem)] max-w-[360px] border-l border-slate-200 bg-[#f7f9f9] shadow-soft-lg">
              {sidebarContent}
            </aside>
          </div>
        ) : null}

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 backdrop-blur-xl">
            <div className="px-3 py-3 sm:px-4 lg:px-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex min-w-0 items-start gap-3 sm:items-center">
                  <button
                    onClick={() => setMobileOpen((prev) => !prev)}
                    aria-label={mobileOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-[#016564] shadow-soft xl:hidden"
                  >
                    {mobileOpen ? <CloseIcon /> : <MenuIcon />}
                  </button>

                  <div className="min-w-0">
                    <h1 className="truncate text-base font-semibold text-[#016564] sm:text-xl lg:text-[28px]">
                      منصة إدارة مخزون المواد التدريبية
                    </h1>
                    <p className="mt-1 text-[11px] text-slate-500 sm:text-xs xl:hidden">
                      {user?.role === 'manager'
                        ? 'وضع المدير'
                        : user?.role === 'warehouse'
                        ? 'وضع مسؤول المخزن'
                        : 'وضع الموظف'}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 xl:mr-auto xl:flex-row xl:items-center">
                  {canUseRoleSwitch ? (
                    <div className="flex w-full flex-wrap items-center rounded-[20px] border border-slate-200 bg-[#f7f9f9] p-1 shadow-inner sm:w-auto sm:rounded-full">
                      {originalUser?.role === 'manager' ? (
                        <>
                          <button
                            onClick={() => switchViewRole('manager')}
                            className={`flex-1 rounded-full px-3 py-2 text-[13px] leading-none transition sm:flex-none sm:px-4 ${
                              user?.role === 'manager'
                                ? 'bg-[#016564] text-white shadow-sm'
                                : 'text-slate-600 hover:bg-white'
                            }`}
                          >
                            مدير
                          </button>

                          <button
                            onClick={() => switchViewRole('user')}
                            className={`flex-1 rounded-full px-3 py-2 text-[13px] leading-none transition sm:flex-none sm:px-4 ${
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
                            className={`flex-1 rounded-full px-3 py-2 text-[13px] leading-none transition sm:flex-none sm:px-4 ${
                              user?.role === 'warehouse'
                                ? 'bg-[#016564] text-white shadow-sm'
                                : 'text-slate-600 hover:bg-white'
                            }`}
                          >
                            مسؤول مخزن
                          </button>

                          <button
                            onClick={() => switchViewRole('user')}
                            className={`flex-1 rounded-full px-3 py-2 text-[13px] leading-none transition sm:flex-none sm:px-4 ${
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

                  <div className="flex items-center gap-2 sm:gap-3">
                    {user?.id ? (
                      <div className="shrink-0">
                        <NotificationBell userId={user.id} />
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1 rounded-[24px] border border-slate-200 bg-white px-3 py-2 shadow-soft sm:flex-none">
                      <div className="flex items-center gap-3">
                        <div className="min-w-0 flex-1 text-right">
                          <p className="truncate text-sm font-medium leading-6 text-slate-900 sm:text-[15px]">
                            {user?.fullName || 'مستخدم النظام'}
                          </p>
                          <p className="truncate text-[11px] leading-5 text-slate-500 sm:text-[12px]">
                            {user?.email || ''}
                          </p>
                        </div>

                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#016564]/8 text-[#016564] sm:h-11 sm:w-11">
                          <UserIcon />
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={logout}
                      title="تسجيل الخروج"
                      aria-label="تسجيل الخروج"
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-soft transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 sm:h-12 sm:w-12"
                    >
                      <LogoutIcon />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 lg:px-6 lg:py-6">
            <div className="mx-auto min-w-0 max-w-[1600px]">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
