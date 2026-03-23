'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';

type AppRole = 'manager' | 'warehouse' | 'user';

type RequestRow = {
  id: string;
  code?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'DRAFT';
  createdAt?: string;
  requesterId?: string;
  requester?: {
    fullName?: string;
    department?: string;
  };
};

type InventoryItem = {
  id: string;
  code?: string;
  name: string;
  quantity: number;
  availableQty: number;
  status?: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
};

type ReturnRequest = {
  id: string;
  code?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt?: string;
  userId?: string;
  requesterId?: string;
  receivedType?: 'GOOD' | 'PARTIAL_DAMAGE' | 'TOTAL_DAMAGE' | null;
  custody?: {
    id?: string;
    user?: {
      fullName?: string;
    };
    item?: {
      name?: string;
      code?: string;
    };
  };
};

type CustodyItem = {
  id: string;
  code: string;
  itemName: string;
  assignedToUserId: string;
  assignedToUserName: string;
  assignedDate: string;
  dueDate?: string | null;
  status: 'ACTIVE' | 'DUE_SOON' | 'OVERDUE' | 'RETURN_REQUESTED' | 'RETURNED';
};

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  isRead?: boolean;
  kind?: 'alert' | 'notification';
  severity?: 'info' | 'action' | 'critical';
};

type SuggestionItem = {
  id: string;
  title: string;
  category: 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER' | string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | string;
  createdAt: string;
  requesterId: string;
};

type FocusRow = {
  id: string;
  title: string;
  note: string;
  href: string;
  level: 'critical' | 'warning' | 'normal' | 'primary' | 'secondary';
};

const RETURNS_STORAGE_KEY = 'inventory_returns';
const CUSTODY_STORAGE_KEY = 'inventory_custody_items';
const NOTIFICATIONS_STORAGE_KEY = 'inventory_notifications';

function loadLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatRelative(value?: string | null) {
  if (!value) return '—';
  try {
    const now = new Date().getTime();
    const then = new Date(value).getTime();
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) return `منذ ${minutes || 1} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  } catch {
    return '—';
  }
}

function daysLate(dueDate?: string | null) {
  if (!dueDate) return 0;
  const now = new Date();
  const due = new Date(dueDate);
  const diff = now.getTime() - due.getTime();
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0;
}

function levelClasses(level: 'critical' | 'warning' | 'normal' | 'primary' | 'secondary') {
  if (level === 'primary') {
    return {
      dot: 'bg-[#016564]',
      surface: 'bg-[#016564]/[0.05]',
      border: 'border-[#016564]/30',
      badge: 'bg-[#016564] text-white shadow-sm',
      arrow: 'text-[#016564]',
    };
  }

  if (level === 'secondary') {
    return {
      dot: 'bg-[#d0b284]',
      surface: 'bg-[#d0b284]/[0.10]',
      border: 'border-[#d0b284]/35',
      badge: 'bg-[#d0b284] text-white shadow-sm',
      arrow: 'text-[#b59667]',
    };
  }

  if (level === 'critical') {
    return {
      dot: 'bg-[#7c1e3e]',
      surface: 'bg-[#7c1e3e]/[0.04]',
      border: 'border-[#7c1e3e]/15',
      badge: 'bg-[#7c1e3e]/10 text-[#7c1e3e]',
      arrow: 'text-[#7c1e3e]',
    };
  }

  if (level === 'warning') {
    return {
      dot: 'bg-[#d0b284]',
      surface: 'bg-[#d0b284]/[0.10]',
      border: 'border-[#d0b284]/30',
      badge: 'bg-[#d0b284]/15 text-[#7a6129]',
      arrow: 'text-[#b59667]',
    };
  }

  return {
    dot: 'bg-[#016564]',
    surface: 'bg-[#016564]/[0.04]',
    border: 'border-[#016564]/15',
    badge: 'bg-[#016564]/10 text-[#016564]',
    arrow: 'text-[#016564]',
  };
}

function Icon({
  name,
  className = 'h-5 w-5',
}: {
  name:
    | 'dashboard'
    | 'requests'
    | 'returns'
    | 'custody'
    | 'inventory'
    | 'audit'
    | 'notifications'
    | 'users'
    | 'arrow'
    | 'trend'
    | 'warning'
    | 'maintenance'
    | 'cleaning'
    | 'purchase'
    | 'other';
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
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
          <path {...common} d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
        </svg>
      );
    case 'audit':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M7 4h7l5 5v11H7z" />
          <path {...common} d="M14 4v5h5M10 13h4M10 17h6" />
        </svg>
      );
    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path {...common} d="M10 19a2 2 0 0 0 4 0" />
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
    case 'trend':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M4 16 10 10l4 4 6-7" />
          <path {...common} d="M17 7h3v3" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M12 4 3.5 19h17L12 4Z" />
          <path {...common} d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'maintenance':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="m14.7 6.3 3 3-8.4 8.4H6.3v-3L14.7 6.3Z" />
          <path {...common} d="m13.3 7.7 3 3" />
        </svg>
      );
    case 'cleaning':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M7 21h10" />
          <path {...common} d="M12 3v12" />
          <path {...common} d="m8 7 4-4 4 4" />
          <path {...common} d="M8 15h8" />
        </svg>
      );
    case 'purchase':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle {...common} cx="9" cy="20" r="1.5" />
          <circle {...common} cx="17" cy="20" r="1.5" />
          <path {...common} d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7" />
        </svg>
      );
    case 'other':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle {...common} cx="12" cy="12" r="8" />
          <path {...common} d="M9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1.1-1.5 2" />
          <path {...common} d="M12 17h.01" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...common} d="M5 12h14" />
          <path {...common} d="m13 6 6 6-6 6" />
        </svg>
      );
  }
}

function SectionTitle({
  title,
  note,
  href,
  action,
}: {
  title: string;
  note: string;
  href?: string;
  action?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-[20px] leading-[1.2] text-slate-900">{title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-500">{note}</p>
      </div>

      {href && action ? (
        <Link
          href={href}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-[#d8e4e2] bg-white px-3 py-2 text-[12px] text-[#016564] shadow-sm sm:w-auto"
        >
          {action}
          <Icon name="arrow" className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

function WarehouseDashboard({ fullName }: { fullName?: string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [custody, setCustody] = useState<CustodyItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [requestsRes, inventoryRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/inventory?limit=200', { cache: 'no-store' }),
      ]);

      const requestsJson = await requestsRes.json().catch(() => null);
      const inventoryJson = await inventoryRes.json().catch(() => null);

      if (!mounted) return;

      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setInventory(Array.isArray(inventoryJson?.data) ? inventoryJson.data : []);
      setReturns(loadLocal<ReturnRequest>(RETURNS_STORAGE_KEY));
      setCustody(loadLocal<CustodyItem>(CUSTODY_STORAGE_KEY));
      setNotifications(loadLocal<NotificationItem>(NOTIFICATIONS_STORAGE_KEY));
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      newRequests: requests.filter((item) => item.status === 'PENDING').length,
      readyToIssue: requests.filter((item) => item.status === 'APPROVED').length,
      pendingReturns: returns.filter((item) => item.status === 'PENDING').length,
      lowStock: inventory.filter((item) => item.status === 'LOW_STOCK').length,
      outOfStock: inventory.filter((item) => item.status === 'OUT_OF_STOCK').length,
      overdue: custody.filter((item) => item.status === 'OVERDUE' || daysLate(item.dueDate) > 0).length,
      unreadAlerts: notifications.filter(
        (item) => !item.isRead && (item.kind === 'alert' || item.severity === 'critical')
      ).length,
    };
  }, [requests, returns, inventory, custody, notifications]);

  const actionRows = useMemo<FocusRow[]>(() => {
    const rows: FocusRow[] = [
      ...requests
        .filter((item) => item.status === 'PENDING')
        .slice(0, 3)
        .map((item) => ({
          id: `req-p-${item.id}`,
          title: 'طلبات جديدة بانتظار التجهيز',
          note: `${item.code || item.id} — ${item.requester?.fullName || item.requester?.department || '—'}`,
          href: '/requests',
          level: 'critical' as const,
        })),
      ...requests
        .filter((item) => item.status === 'APPROVED')
        .slice(0, 3)
        .map((item) => ({
          id: `req-a-${item.id}`,
          title: 'طلبات جاهزة للصرف',
          note: `${item.code || item.id} — ${item.requester?.fullName || item.requester?.department || '—'}`,
          href: '/requests',
          level: 'warning' as const,
        })),
      ...returns
        .filter((item) => item.status === 'PENDING')
        .slice(0, 2)
        .map((item) => ({
          id: `ret-${item.id}`,
          title: 'إرجاعات بانتظار الاستلام',
          note: `${item.code || item.id} — ${item.custody?.user?.fullName || '—'}`,
          href: '/returns',
          level: 'warning' as const,
        })),
    ];

    return rows.slice(0, 8);
  }, [requests, returns]);

  const quickLinks = [
    { title: 'تجهيز الطلبات', href: '/requests', icon: 'requests' as const, note: `${stats.newRequests} جديدة` },
    { title: 'صرف المواد', href: '/requests', icon: 'inventory' as const, note: `${stats.readyToIssue} جاهزة` },
    { title: 'استلام الإرجاع', href: '/returns', icon: 'returns' as const, note: `${stats.pendingReturns} بانتظارك` },
    { title: 'العهد الحالية', href: '/custody', icon: 'custody' as const, note: `${stats.overdue} متأخرة` },
    { title: 'المخزون', href: '/inventory', icon: 'inventory' as const, note: `${stats.lowStock + stats.outOfStock} تنبيه` },
    { title: 'الإشعارات', href: '/notifications', icon: 'notifications' as const, note: `${stats.unreadAlerts} غير مقروءة` },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-[#d8e4e2] bg-[linear-gradient(135deg,#016564_0%,#0c706e_55%,#114f4f_100%)] p-4 text-white shadow-[0_18px_50px_rgba(1,101,100,0.18)] sm:rounded-[32px] sm:p-6">
        <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[#d0b284]/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

        <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.95fr] sm:gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px]">
              <Icon name="inventory" className="h-4 w-4" />
              لوحة مسؤول المخزن
            </div>

            <h1 className="mt-3 text-[24px] leading-[1.25] sm:mt-4 sm:text-[32px]">
              {fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
            </h1>
            <p className="mt-3 max-w-[760px] text-[13px] leading-7 text-white/85 sm:text-[14px] sm:leading-8">
              رؤية سريعة لما يحتاج التنفيذ الآن داخل المخزون، الطلبات، والإرجاعات.
            </p>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {[
              { label: 'طلبات جديدة', value: stats.newRequests, icon: 'requests' as const },
              { label: 'جاهزة للصرف', value: stats.readyToIssue, icon: 'inventory' as const },
              { label: 'إرجاعات معلقة', value: stats.pendingReturns, icon: 'returns' as const },
              { label: 'تنبيهات المخزون', value: stats.lowStock + stats.outOfStock, icon: 'warning' as const },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-white/10 bg-white/10 p-3.5 backdrop-blur-sm sm:rounded-[24px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] text-white/75 sm:text-[13px]">{item.label}</div>
                    <div className="mt-2 text-[24px] leading-none sm:text-[30px]">{item.value}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-2.5 sm:p-3">
                    <Icon name={item.icon} className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
        {[
          {
            title: 'طلبات جديدة بانتظار التجهيز',
            value: stats.newRequests,
            note: 'تحتاج معالجة مباشرة',
            href: '/requests',
            icon: 'requests' as const,
            level: stats.newRequests > 0 ? 'critical' : 'normal',
          },
          {
            title: 'طلبات جاهزة للصرف',
            value: stats.readyToIssue,
            note: 'اعتمدت وتحتاج تنفيذًا',
            href: '/requests',
            icon: 'inventory' as const,
            level: stats.readyToIssue > 0 ? 'warning' : 'normal',
          },
          {
            title: 'إرجاعات بانتظار الاستلام',
            value: stats.pendingReturns,
            note: 'تحتاج استلامًا وتوثيقًا',
            href: '/returns',
            icon: 'returns' as const,
            level: stats.pendingReturns > 0 ? 'warning' : 'normal',
          },
          {
            title: 'مواد منخفضة المخزون',
            value: stats.lowStock,
            note: 'قبل أن تتحول إلى نفاد',
            href: '/inventory',
            icon: 'warning' as const,
            level: stats.lowStock > 0 ? 'warning' : 'normal',
          },
          {
            title: 'مواد نافدة أو غير متاحة',
            value: stats.outOfStock,
            note: 'تؤثر على تلبية الطلبات',
            href: '/inventory',
            icon: 'inventory' as const,
            level: stats.outOfStock > 0 ? 'critical' : 'normal',
          },
          {
            title: 'عهد متأخرة',
            value: stats.overdue,
            note: 'تحتاج متابعة فورية',
            href: '/custody',
            icon: 'custody' as const,
            level: stats.overdue > 0 ? 'critical' : 'normal',
          },
        ].map((card) => {
          const tone = levelClasses(card.level);

          return (
            <Link key={card.title} href={card.href}>
              <Card className={`h-full rounded-[22px] border p-4 transition hover:-translate-y-[2px] hover:shadow-lg sm:rounded-[28px] sm:p-5 ${tone.border} ${tone.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] leading-6 text-slate-600">{card.title}</div>
                    <div className="mt-3 text-[28px] leading-none text-slate-900 sm:text-[34px]">{card.value}</div>
                    <div className="mt-2 text-[12px] leading-6 text-slate-600 sm:mt-3 sm:text-[13px] sm:leading-7">{card.note}</div>
                  </div>

                  <div className={`rounded-[18px] p-2.5 sm:rounded-[20px] sm:p-3 ${tone.badge}`}>
                    <Icon name={card.icon} className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr] sm:gap-4">
        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionTitle title="ما الذي تعمل عليه الآن" note="أهم العناصر التنفيذية الحالية." href="/requests" action="فتح الطلبات" />

          {actionRows.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#d8e4e2] p-6 text-center text-slate-500 sm:rounded-[22px] sm:p-10">
              لا توجد عناصر عاجلة حاليًا
            </div>
          ) : (
            <div className="space-y-3">
              {actionRows.map((row) => {
                const tone = levelClasses(row.level);

                return (
                  <Link key={row.id} href={row.href} className={`block rounded-[20px] border p-3.5 sm:rounded-[22px] sm:p-4 ${tone.border} ${tone.surface}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] text-slate-900">{row.title}</div>
                        <div className="mt-1 text-[12px] leading-6 text-slate-600">{row.note}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionTitle title="اختصارات التنفيذ" note="أكثر المسارات استخدامًا لمسؤول المخزن." />

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[20px] border border-[#e0ebe9] bg-[#fbfdfd] p-3.5 transition hover:border-[#c6dad7] hover:bg-white hover:shadow-md sm:rounded-[22px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-[18px] bg-[#016564]/8 p-2.5 text-[#016564] sm:p-3">
                    <Icon name={item.icon} className="h-5 w-5" />
                  </div>
                  <Icon name="arrow" className="h-4 w-4 text-slate-400 transition group-hover:text-[#016564]" />
                </div>

                <div className="mt-3 text-[14px] text-slate-900 sm:mt-4 sm:text-[15px]">{item.title}</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-500">{item.note}</div>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function ManagerDashboard({ fullName }: { fullName?: string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [custody, setCustody] = useState<CustodyItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<Array<{ id: string; action: string; entity: string; entityId?: string | null; createdAt: string; user?: { fullName?: string; role?: string | null } | null }>>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [requestsRes, inventoryRes, auditRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/inventory?limit=200', { cache: 'no-store' }),
        fetch('/api/audit-logs?limit=20', { cache: 'no-store' }).catch(() => null),
      ]);

      const requestsJson = await requestsRes.json().catch(() => null);
      const inventoryJson = await inventoryRes.json().catch(() => null);
      const auditJson = auditRes ? await auditRes.json().catch(() => null) : null;

      if (!mounted) return;

      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setInventory(Array.isArray(inventoryJson?.data) ? inventoryJson.data : []);
      setReturns(loadLocal<ReturnRequest>(RETURNS_STORAGE_KEY));
      setCustody(loadLocal<CustodyItem>(CUSTODY_STORAGE_KEY));
      setNotifications(loadLocal<NotificationItem>(NOTIFICATIONS_STORAGE_KEY));
      setAuditLogs(Array.isArray(auditJson?.data) ? auditJson.data : []);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const pendingRequests = requests.filter((item) => item.status === 'PENDING').length;
    const approvedNotIssued = requests.filter((item) => item.status === 'APPROVED').length;
    const pendingReturns = returns.filter((item) => item.status === 'PENDING').length;
    const overdueCustody = custody.filter((item) => item.status === 'OVERDUE' || daysLate(item.dueDate) > 0).length;
    const lowStock = inventory.filter((item) => item.status === 'LOW_STOCK').length;
    const criticalAlerts = notifications.filter(
      (item) => item.severity === 'critical' || item.kind === 'alert'
    ).length;
    const todayOps = auditLogs.filter((item) => {
      const created = new Date(item.createdAt);
      const today = new Date();
      return (
        created.getFullYear() === today.getFullYear() &&
        created.getMonth() === today.getMonth() &&
        created.getDate() === today.getDate()
      );
    }).length;

    return {
      pendingRequests,
      approvedNotIssued,
      pendingReturns,
      overdueCustody,
      lowStock,
      criticalAlerts,
      todayOps,
    };
  }, [requests, returns, custody, inventory, notifications, auditLogs]);

  const decisionRows = useMemo<FocusRow[]>(() => {
    const rows: FocusRow[] = [];

    if (stats.pendingRequests > 0) {
      rows.push({
        id: 'dr-1',
        title: 'تراكم في الطلبات الجديدة',
        note: `${stats.pendingRequests} طلبًا بانتظار المعالجة الأولية`,
        href: '/requests',
        level: 'critical',
      });
    }

    if (stats.approvedNotIssued > 0) {
      rows.push({
        id: 'dr-2',
        title: 'طلبات معتمدة لم تُنفذ بعد',
        note: `${stats.approvedNotIssued} طلبًا جاهزًا للصرف ولم يغلق بعد`,
        href: '/requests',
        level: 'warning',
      });
    }

    if (stats.pendingReturns > 0) {
      rows.push({
        id: 'dr-3',
        title: 'إرجاعات معلقة',
        note: `${stats.pendingReturns} حالة تحتاج استلامًا وتوثيقًا`,
        href: '/returns',
        level: 'warning',
      });
    }

    if (stats.overdueCustody > 0) {
      rows.push({
        id: 'dr-4',
        title: 'عهد متأخرة',
        note: `${stats.overdueCustody} عهدة تحتاج متابعة إدارية`,
        href: '/custody',
        level: 'critical',
      });
    }

    if (stats.lowStock > 0) {
      rows.push({
        id: 'dr-5',
        title: 'مواد منخفضة المخزون',
        note: `${stats.lowStock} صنفًا يحتاج قرار دعم أو إحلال`,
        href: '/inventory',
        level: 'warning',
      });
    }

    if (stats.criticalAlerts > 0) {
      rows.push({
        id: 'dr-6',
        title: 'تنبيهات حرجة نشطة',
        note: `${stats.criticalAlerts} تنبيهًا يستحق مراجعة مباشرة`,
        href: '/notifications',
        level: 'critical',
      });
    }

    return rows.slice(0, 6);
  }, [stats]);

  const auditPreview = useMemo(() => {
    return auditLogs.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.action || 'إجراء مسجل',
      note: `${item.user?.fullName || 'غير معروف'} — ${formatRelative(item.createdAt)}`,
      href: '/audit-logs',
      level: 'normal' as const,
    }));
  }, [auditLogs]);

  const quickLinks = [
    { title: 'الطلبات', href: '/requests', icon: 'requests' as const, note: 'تشغيل ومتابعة' },
    { title: 'الإرجاعات', href: '/returns', icon: 'returns' as const, note: 'مراجعة وإقفال' },
    { title: 'العهد', href: '/custody', icon: 'custody' as const, note: 'متابعة الالتزام' },
    { title: 'المخزون', href: '/inventory', icon: 'inventory' as const, note: 'التوفر والحركة' },
    { title: 'سجل التدقيق', href: '/audit-logs', icon: 'audit' as const, note: 'رقابة وتتبّع' },
    { title: 'المستخدمون', href: '/users', icon: 'users' as const, note: 'الأدوار والصلاحيات' },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-[#d8e4e2] bg-[linear-gradient(135deg,#016564_0%,#0c706e_55%,#114f4f_100%)] p-4 text-white shadow-[0_18px_50px_rgba(1,101,100,0.18)] sm:rounded-[32px] sm:p-6">
        <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[#d0b284]/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

        <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.95fr] sm:gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px]">
              <Icon name="dashboard" className="h-4 w-4" />
              لوحة المدير
            </div>

            <h1 className="mt-3 text-[24px] leading-[1.25] sm:mt-4 sm:text-[32px]">
              {fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
            </h1>
            <p className="mt-3 max-w-[760px] text-[13px] leading-7 text-white/85 sm:text-[14px] sm:leading-8">
              لوحة قرار ورقابة: أين التعثر، أين التراكم، وما الذي يحتاج تدخلًا إداريًا الآن.
            </p>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {[
              { label: 'طلبات معلقة', value: stats.pendingRequests, icon: 'requests' as const },
              { label: 'غير منفذ بعد الاعتماد', value: stats.approvedNotIssued, icon: 'trend' as const },
              { label: 'إرجاعات معلقة', value: stats.pendingReturns, icon: 'returns' as const },
              { label: 'تنبيهات حرجة', value: stats.criticalAlerts, icon: 'warning' as const },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-white/10 bg-white/10 p-3.5 backdrop-blur-sm sm:rounded-[24px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] text-white/75 sm:text-[13px]">{item.label}</div>
                    <div className="mt-2 text-[24px] leading-none sm:text-[30px]">{item.value}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-2.5 sm:p-3">
                    <Icon name={item.icon} className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
        {[
          {
            title: 'الطلبات المعلقة',
            value: stats.pendingRequests,
            note: 'طلبات ما زالت تنتظر المعالجة',
            href: '/requests',
            icon: 'requests' as const,
            level: stats.pendingRequests > 0 ? 'critical' : 'normal',
          },
          {
            title: 'طلبات معتمدة غير منفذة',
            value: stats.approvedNotIssued,
            note: 'اعتمدت ولم تصل إلى التنفيذ بعد',
            href: '/requests',
            icon: 'trend' as const,
            level: stats.approvedNotIssued > 0 ? 'warning' : 'normal',
          },
          {
            title: 'الإرجاعات المعلقة',
            value: stats.pendingReturns,
            note: 'إرجاعات لم تُغلق بعد',
            href: '/returns',
            icon: 'returns' as const,
            level: stats.pendingReturns > 0 ? 'warning' : 'normal',
          },
          {
            title: 'العهد المتأخرة',
            value: stats.overdueCustody,
            note: 'عهد تستحق متابعة إدارية',
            href: '/custody',
            icon: 'custody' as const,
            level: stats.overdueCustody > 0 ? 'critical' : 'normal',
          },
          {
            title: 'مواد منخفضة المخزون',
            value: stats.lowStock,
            note: 'تحتاج قرار دعم أو إعادة توزيع',
            href: '/inventory',
            icon: 'inventory' as const,
            level: stats.lowStock > 0 ? 'warning' : 'normal',
          },
          {
            title: 'العمليات المنفذة اليوم',
            value: stats.todayOps,
            note: 'نبض التنفيذ اليومي المسجل',
            href: '/audit-logs',
            icon: 'audit' as const,
            level: 'normal',
          },
        ].map((card) => {
          const tone = levelClasses(card.level);

          return (
            <Link key={card.title} href={card.href}>
              <Card className={`h-full rounded-[22px] border p-4 transition hover:-translate-y-[2px] hover:shadow-lg sm:rounded-[28px] sm:p-5 ${tone.border} ${tone.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] leading-6 text-slate-600">{card.title}</div>
                    <div className="mt-3 text-[28px] leading-none text-slate-900 sm:text-[34px]">{card.value}</div>
                    <div className="mt-2 text-[12px] leading-6 text-slate-600 sm:mt-3 sm:text-[13px] sm:leading-7">{card.note}</div>
                  </div>

                  <div className={`rounded-[18px] p-2.5 sm:rounded-[20px] sm:p-3 ${tone.badge}`}>
                    <Icon name={card.icon} className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr] sm:gap-4">
        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionTitle
            title="أين القرار الآن"
            note="العناصر التي تعطي المدير صورة واضحة عن موضع التدخل."
            href="/requests"
            action="فتح التشغيل"
          />

          {decisionRows.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#d8e4e2] p-6 text-center text-slate-500 sm:rounded-[22px] sm:p-10">
              لا توجد مؤشرات حرجة حالية
            </div>
          ) : (
            <div className="space-y-3">
              {decisionRows.map((row) => {
                const tone = levelClasses(row.level);

                return (
                  <Link key={row.id} href={row.href} className={`block rounded-[20px] border p-3.5 sm:rounded-[22px] sm:p-4 ${tone.border} ${tone.surface}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] text-slate-900">{row.title}</div>
                        <div className="mt-1 text-[12px] leading-6 text-slate-600">{row.note}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <div className="grid gap-3 sm:gap-4">
          <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
            <SectionTitle title="اختصارات المدير" note="أهم المسارات لاتخاذ القرار والمتابعة." />

            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {quickLinks.map((item) => (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group rounded-[20px] border border-[#e0ebe9] bg-[#fbfdfd] p-3.5 transition hover:border-[#c6dad7] hover:bg-white hover:shadow-md sm:rounded-[22px] sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-[18px] bg-[#016564]/8 p-2.5 text-[#016564] sm:p-3">
                      <Icon name={item.icon} className="h-5 w-5" />
                    </div>
                    <Icon name="arrow" className="h-4 w-4 text-slate-400 transition group-hover:text-[#016564]" />
                  </div>

                  <div className="mt-3 text-[14px] text-slate-900 sm:mt-4 sm:text-[15px]">{item.title}</div>
                  <div className="mt-1 text-[12px] leading-6 text-slate-500">{item.note}</div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
            <SectionTitle
              title="آخر ما سُجل رقابيًا"
              note="معاينة سريعة لأحدث السجلات ذات الأثر."
              href="/audit-logs"
              action="سجل التدقيق"
            />

            {auditPreview.length === 0 ? (
              <div className="rounded-[20px] border border-dashed border-[#d8e4e2] p-6 text-center text-slate-500 sm:rounded-[22px] sm:p-8">
                لا توجد سجلات حديثة
              </div>
            ) : (
              <div className="space-y-3">
                {auditPreview.map((item) => {
                  const tone = levelClasses(item.level);

                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`block rounded-[20px] border p-3.5 transition hover:shadow-md sm:p-4 ${tone.border} ${tone.surface}`}
                    >
                      <div className="flex items-start gap-3">
                        <span className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] text-slate-900">{item.title}</div>
                          <div className="mt-1 text-[12px] leading-6 text-slate-600">{item.note}</div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </section>
    </div>
  );
}

function UserDashboard({ fullName, userId }: { fullName?: string; userId?: string }) {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [suggestions, setSuggestions] = useState<SuggestionItem[]>([]);
  const [returnsList, setReturnsList] = useState<ReturnRequest[]>([]);
  const [custodyList, setCustodyList] = useState<CustodyItem[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [requestsRes, suggestionsRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/suggestions', { cache: 'no-store' }).catch(() => null),
      ]);

      const requestsJson = await requestsRes.json().catch(() => null);
      const suggestionsJson = suggestionsRes ? await suggestionsRes.json().catch(() => null) : null;

      if (!mounted) return;

      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setSuggestions(Array.isArray(suggestionsJson?.data) ? suggestionsJson.data : []);
      setReturnsList(loadLocal<ReturnRequest>(RETURNS_STORAGE_KEY));
      setCustodyList(loadLocal<CustodyItem>(CUSTODY_STORAGE_KEY));
      setNotifications(loadLocal<NotificationItem>(NOTIFICATIONS_STORAGE_KEY));
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const myRequests = useMemo(
    () => requests.filter((item) => !userId || item.requesterId === userId),
    [requests, userId]
  );

  const mySuggestions = useMemo(
    () => suggestions.filter((item) => !userId || item.requesterId === userId),
    [suggestions, userId]
  );

  const myReturns = useMemo(
    () => returnsList.filter((item) => !userId || item.userId === userId || item.requesterId === userId),
    [returnsList, userId]
  );

  const myCustody = useMemo(
    () => custodyList.filter((item) => !userId || item.assignedToUserId === userId),
    [custodyList, userId]
  );

  const myNotifications = useMemo(
    () => notifications.filter(() => true),
    [notifications]
  );

  const stats = useMemo(() => {
    return {
      openRequests: myRequests.filter((item) => item.status === 'PENDING' || item.status === 'APPROVED').length,
      activeCustody: myCustody.filter((item) => item.status !== 'RETURNED').length,
      pendingReturns: myReturns.filter((item) => item.status === 'PENDING').length,
      unreadNotifications: myNotifications.filter((item) => !item.isRead).length,
      overdueCustody: myCustody.filter((item) => item.status === 'OVERDUE' || daysLate(item.dueDate) > 0).length,
      openOtherRequests: mySuggestions.filter((item) => item.status === 'PENDING' || item.status === 'UNDER_REVIEW').length,
    };
  }, [myRequests, myCustody, myReturns, myNotifications, mySuggestions]);

  const startCards = [
    {
      title: 'طلب مواد',
      note: 'لصرف مواد متوفرة من المخزون',
      href: '/requests?new=1',
      icon: 'requests' as const,
      tone: 'primary' as const,
    },
    {
      title: 'طلب إرجاع مواد',
      note: 'لإرجاع المواد القابلة للإعادة من عهدتك',
      href: '/returns?new=1',
      icon: 'returns' as const,
      tone: 'secondary' as const,
    },
    {
      title: 'طلب صيانة',
      note: 'عند وجود عطل أو خلل في مادة أو تجهيز',
      href: '/suggestions?new=1&type=MAINTENANCE',
      icon: 'maintenance' as const,
      tone: 'normal' as const,
    },
    {
      title: 'طلب نظافة',
      note: 'لاحتياج تنظيف أو معالجة بيئة تشغيل',
      href: '/suggestions?new=1&type=CLEANING',
      icon: 'cleaning' as const,
      tone: 'normal' as const,
    },
    {
      title: 'طلب شراء مباشر',
      note: 'عند الحاجة إلى صنف غير متوفر أو غير كافٍ',
      href: '/suggestions?new=1&type=PURCHASE',
      icon: 'purchase' as const,
      tone: 'normal' as const,
    },
    {
      title: 'طلبات أخرى',
      note: 'لأي احتياج لا يندرج ضمن المسارات السابقة',
      href: '/suggestions?new=1&type=OTHER',
      icon: 'other' as const,
      tone: 'normal' as const,
    },
  ];

  const currentStatusCards = [
    {
      title: 'طلباتي المفتوحة',
      value: stats.openRequests + stats.openOtherRequests,
      note: 'طلبات ما زالت تحت الإجراء أو بانتظار التنفيذ',
      href: '/requests',
      icon: 'requests' as const,
      level: stats.openRequests + stats.openOtherRequests > 0 ? 'warning' as const : 'normal' as const,
    },
    {
      title: 'عهدتي الحالية',
      value: stats.activeCustody,
      note: 'مواد ما زالت بعهدتك ولم تغلق بعد',
      href: '/custody',
      icon: 'custody' as const,
      level: 'normal' as const,
    },
    {
      title: 'طلبات إرجاع معلقة',
      value: stats.pendingReturns,
      note: 'طلبات أرسلتها وما زالت بانتظار الاستلام',
      href: '/returns',
      icon: 'returns' as const,
      level: stats.pendingReturns > 0 ? 'warning' as const : 'normal' as const,
    },
    {
      title: 'إشعارات جديدة',
      value: stats.unreadNotifications,
      note: 'اعتمادات أو ملاحظات أو تحديثات على طلباتك',
      href: '/notifications',
      icon: 'notifications' as const,
      level: stats.unreadNotifications > 0 ? 'critical' as const : 'normal' as const,
    },
  ];

  const updates = useMemo<FocusRow[]>(() => {
    const rows: FocusRow[] = [
      ...myNotifications
        .slice(0, 3)
        .map((item) => ({
          id: `not-${item.id}`,
          title: item.title,
          note: item.message,
          href: '/notifications',
          level:
            item.severity === 'critical'
              ? 'critical'
              : item.kind === 'alert'
              ? 'warning'
              : 'normal',
        })),
      ...myCustody
        .filter((item) => item.status === 'OVERDUE' || daysLate(item.dueDate) > 0)
        .slice(0, 2)
        .map((item) => ({
          id: `cus-${item.id}`,
          title: 'لديك عهدة متأخرة',
          note: `${item.itemName} — ${daysLate(item.dueDate)} يوم تأخير`,
          href: '/custody',
          level: 'critical' as const,
        })),
      ...myReturns
        .filter((item) => item.status === 'PENDING')
        .slice(0, 2)
        .map((item) => ({
          id: `ret-${item.id}`,
          title: 'طلب إرجاع بانتظار الاستلام',
          note: `${item.code || item.id} — ${item.custody?.item?.name || 'مادة مرتبطة'}`,
          href: '/returns',
          level: 'warning' as const,
        })),
    ];

    return rows.slice(0, 6);
  }, [myNotifications, myCustody, myReturns]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="relative overflow-hidden rounded-[24px] border border-[#d8e4e2] bg-[linear-gradient(135deg,#016564_0%,#0c706e_55%,#114f4f_100%)] p-4 text-white shadow-[0_18px_50px_rgba(1,101,100,0.18)] sm:rounded-[32px] sm:p-6">
        <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[#d0b284]/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/5 blur-2xl" />

        <div className="relative grid gap-4 xl:grid-cols-[1.25fr_0.95fr] sm:gap-5">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px]">
              <Icon name="dashboard" className="h-4 w-4" />
              بوابة الموظف
            </div>

            <h1 className="mt-3 text-[24px] leading-[1.25] sm:mt-4 sm:text-[32px]">
              {fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
            </h1>
            <p className="mt-3 max-w-[760px] text-[13px] leading-7 text-white/85 sm:text-[14px] sm:leading-8">
              من هنا تبدأ كل احتياجاتك بوضوح: طلب مواد، إرجاع، صيانة، نظافة، شراء مباشر، أو أي طلب آخر.
            </p>
          </div>

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {[
              { label: 'طلباتي المفتوحة', value: stats.openRequests + stats.openOtherRequests, icon: 'requests' as const },
              { label: 'مواد بعهدتي', value: stats.activeCustody, icon: 'custody' as const },
              { label: 'إرجاعات معلقة', value: stats.pendingReturns, icon: 'returns' as const },
              { label: 'إشعارات جديدة', value: stats.unreadNotifications, icon: 'notifications' as const },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[20px] border border-white/10 bg-white/10 p-3.5 backdrop-blur-sm sm:rounded-[24px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[12px] text-white/75 sm:text-[13px]">{item.label}</div>
                    <div className="mt-2 text-[24px] leading-none sm:text-[30px]">{item.value}</div>
                  </div>
                  <div className="rounded-2xl bg-white/10 p-2.5 sm:p-3">
                    <Icon name={item.icon} className="h-6 w-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <SectionTitle
          title="ماذا تريد أن تنجز اليوم؟"
          note="اختر المسار الصحيح مباشرة دون حيرة أو تنقل عشوائي."
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 sm:gap-4">
          {startCards.map((card) => {
            const tone = levelClasses(card.tone);

            return (
              <Link
                key={card.title}
                href={card.href}
                className={`group rounded-[22px] border p-4 transition hover:-translate-y-[2px] hover:shadow-lg sm:rounded-[24px] sm:p-5 ${tone.border} ${tone.surface}`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-[18px] p-3 ${tone.badge}`}>
                    <Icon name={card.icon} className="h-6 w-6" />
                  </div>
                  <Icon
                    name="arrow"
                    className={`h-4 w-4 transition ${tone.arrow} group-hover:scale-110`}
                  />
                </div>

                <div className="mt-3 text-[16px] text-slate-900 sm:mt-4 sm:text-[18px]">{card.title}</div>
                <div className="mt-2 text-[12px] leading-6 text-slate-600 sm:text-[13px] sm:leading-7">{card.note}</div>
              </Link>
            );
          })}
        </div>
      </Card>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        {currentStatusCards.map((card) => {
          const tone = levelClasses(card.level);

          return (
            <Link key={card.title} href={card.href}>
              <Card className={`h-full rounded-[22px] border p-4 transition hover:-translate-y-[2px] hover:shadow-lg sm:rounded-[26px] sm:p-5 ${tone.border} ${tone.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="text-[13px] leading-6 text-slate-600">{card.title}</div>
                    <div className="mt-3 text-[28px] leading-none text-slate-900 sm:text-[32px]">{card.value}</div>
                    <div className="mt-2 text-[12px] leading-6 text-slate-600 sm:mt-3 sm:text-[13px] sm:leading-7">{card.note}</div>
                  </div>

                  <div className={`rounded-[18px] p-2.5 sm:rounded-[20px] sm:p-3 ${tone.badge}`}>
                    <Icon name={card.icon} className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </section>

      <section className="grid gap-3 xl:grid-cols-[1.15fr_0.85fr] sm:gap-4">
        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionTitle
            title="وضعك الحالي"
            note="أهم ما يحتاج منك متابعة أو ينتظر ردًا أو استلامًا."
            href="/notifications"
            action="كل التحديثات"
          />

          {updates.length === 0 ? (
            <div className="rounded-[20px] border border-dashed border-[#d8e4e2] p-6 text-center text-slate-500 sm:rounded-[22px] sm:p-10">
              لا توجد مستجدات حالية
            </div>
          ) : (
            <div className="space-y-3">
              {updates.map((row) => {
                const tone = levelClasses(row.level);

                return (
                  <Link key={row.id} href={row.href} className={`block rounded-[20px] border p-3.5 sm:rounded-[22px] sm:p-4 ${tone.border} ${tone.surface}`}>
                    <div className="flex items-start gap-3">
                      <span className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] text-slate-900">{row.title}</div>
                        <div className="mt-1 text-[12px] leading-6 text-slate-600">{row.note}</div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionTitle
            title="اختصارات سريعة"
            note="المسارات الأكثر استخدامًا في العمل اليومي."
          />

          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {[
              { title: 'طلباتي', href: '/requests', icon: 'requests' as const },
              { title: 'عهدتي', href: '/custody', icon: 'custody' as const },
              { title: 'الإرجاعات', href: '/returns', icon: 'returns' as const },
              { title: 'الطلبات الأخرى', href: '/suggestions', icon: 'other' as const },
            ].map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[20px] border border-[#e0ebe9] bg-[#fbfdfd] p-3.5 transition hover:border-[#c6dad7] hover:bg-white hover:shadow-md sm:rounded-[22px] sm:p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="rounded-[18px] bg-[#016564]/8 p-2.5 text-[#016564] sm:p-3">
                    <Icon name={item.icon} className="h-5 w-5" />
                  </div>
                  <Icon name="arrow" className="h-4 w-4 text-slate-400 transition group-hover:text-[#016564]" />
                </div>

                <div className="mt-3 text-[14px] text-slate-900 sm:mt-4 sm:text-[15px]">{item.title}</div>
              </Link>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = ((user?.role || 'user').toLowerCase() as AppRole);

  if (role === 'manager') {
    return <ManagerDashboard fullName={user?.fullName} />;
  }

  if (role === 'warehouse') {
    return <WarehouseDashboard fullName={user?.fullName} />;
  }

  return <UserDashboard fullName={user?.fullName} userId={user?.id} />;
}