'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';

type AppRole = 'manager' | 'warehouse' | 'user';

type RequestRow = {
  id: string;
  code?: string;
  status?: string;
  createdAt?: string;
  processedAt?: string | null;
  requesterId?: string;
  requester?: {
    fullName?: string;
    department?: string;
  } | null;
  items?: Array<{
    id: string;
    quantity?: number;
    expectedReturnDate?: string | null;
    item?: {
      id?: string;
      name?: string;
      code?: string;
      type?: string;
      availableQty?: number;
      quantity?: number;
    } | null;
    activeIssuedQty?: number;
  }>;
  custodyRecords?: Array<{
    id: string;
    status?: string;
    expectedReturn?: string | null;
  }>;
};

type InventoryRow = {
  id: string;
  code?: string;
  name?: string;
  quantity?: number;
  availableQty?: number;
  status?: string;
};

type ReturnRow = {
  id: string;
  code?: string;
  status?: string;
  createdAt?: string;
  processedAt?: string | null;
  requesterId?: string;
  returnType?: string | null;
  receivedType?: string | null;
  custody?: {
    id?: string;
    user?: { fullName?: string } | null;
    item?: { name?: string; code?: string } | null;
  } | null;
  requestItem?: {
    id?: string;
    item?: { name?: string; code?: string } | null;
  } | null;
};

type CustodyRow = {
  id: string;
  issueDate?: string;
  dueDate?: string | null;
  status?: string;
  item?: {
    name?: string | null;
    code?: string | null;
    type?: string | null;
  } | null;
  returnRequests?: Array<{
    id: string;
    status?: string;
  }>;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  isRead?: boolean;
  createdAt?: string;
  entityType?: string | null;
  type?: string | null;
};

type DashboardEnvelope<T> = {
  data?: T[];
};

type FocusRow = {
  id: string;
  title: string;
  note: string;
  href: string;
  level: 'critical' | 'warning' | 'normal' | 'primary' | 'secondary';
};

type StatCard = {
  id: string;
  label: string;
  value: number;
  href: string;
  tone: 'default' | 'success' | 'warning' | 'danger';
};

function formatRelative(value?: string | null) {
  if (!value) return '—';
  try {
    const now = Date.now();
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

function daysLate(value?: string | null) {
  if (!value) return 0;
  try {
    const due = new Date(value).getTime();
    const today = Date.now();
    const diff = today - due;
    return diff > 0 ? Math.floor(diff / (1000 * 60 * 60 * 24)) : 0;
  } catch {
    return 0;
  }
}

function daysRemaining(value?: string | null) {
  if (!value) return Number.POSITIVE_INFINITY;
  try {
    const due = new Date(value).getTime();
    const today = Date.now();
    return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function toneClasses(tone: StatCard['tone']) {
  if (tone === 'success') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  if (tone === 'danger') return 'border-red-200 bg-red-50 text-red-700';
  return 'border-slate-200 bg-slate-50 text-slate-700';
}

function levelClasses(level: FocusRow['level']) {
  if (level === 'critical') return 'border-red-200 bg-red-50';
  if (level === 'warning') return 'border-amber-200 bg-amber-50';
  if (level === 'primary') return 'border-[#016564]/20 bg-[#016564]/5';
  if (level === 'secondary') return 'border-slate-200 bg-slate-50';
  return 'border-emerald-200 bg-emerald-50';
}

async function getRows<T>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: 'no-store', credentials: 'include' }).catch(() => null);
  if (!response || !response.ok) return [];
  const json = (await response.json().catch(() => ({ data: [] }))) as DashboardEnvelope<T> | T[];
  if (Array.isArray(json)) return json as T[];
  return Array.isArray(json?.data) ? json.data : [];
}

function SectionHeader({
  title,
  subtitle,
  actionHref,
  actionLabel,
}: {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-[18px] font-bold text-slate-900 sm:text-[20px]">{title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-500">{subtitle}</p>
      </div>

      {actionHref && actionLabel ? (
        <Link
          href={actionHref}
          className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-[#016564] shadow-soft transition hover:border-[#016564]/20 hover:bg-[#f7fbfa]"
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role || 'user') as AppRole;

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [returnsRows, setReturnsRows] = useState<ReturnRow[]>([]);
  const [custodyRows, setCustodyRows] = useState<CustodyRow[]>([]);
  const [inventoryRows, setInventoryRows] = useState<InventoryRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const [requestsData, returnsData, custodyData, inventoryData, notificationsData] = await Promise.all([
        getRows<RequestRow>('/api/requests'),
        getRows<ReturnRow>('/api/returns'),
        getRows<CustodyRow>('/api/custody'),
        getRows<InventoryRow>('/api/inventory'),
        getRows<NotificationRow>('/api/notifications'),
      ]);

      if (!mounted) return;

      setRequests(requestsData);
      setReturnsRows(returnsData);
      setCustodyRows(custodyData);
      setInventoryRows(inventoryData);
      setNotifications(notificationsData);
      setLoading(false);
    };

    load();
    const timer = window.setInterval(load, 20000);

    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const requestPending = useMemo(
    () => requests.filter((item) => item.status === 'PENDING'),
    [requests]
  );

  const requestIssued = useMemo(
    () => requests.filter((item) => item.status === 'ISSUED'),
    [requests]
  );

  const pendingReturns = useMemo(
    () => returnsRows.filter((item) => item.status === 'PENDING'),
    [returnsRows]
  );

  const rejectedRequests = useMemo(
    () => requests.filter((item) => item.status === 'REJECTED'),
    [requests]
  );

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead),
    [notifications]
  );

  const openCustody = useMemo(
    () => custodyRows.filter((item) => item.status === 'ACTIVE' || item.status === 'RETURN_REQUESTED'),
    [custodyRows]
  );

  const overdueCustody = useMemo(
    () => custodyRows.filter((item) => (item.status === 'ACTIVE' || item.status === 'RETURN_REQUESTED') && daysLate(item.dueDate) > 0),
    [custodyRows]
  );

  const dueSoonCustody = useMemo(
    () => custodyRows.filter((item) => item.status === 'ACTIVE' && daysRemaining(item.dueDate) >= 0 && daysRemaining(item.dueDate) <= 3),
    [custodyRows]
  );

  const lowStockRows = useMemo(
    () => inventoryRows.filter((item) => String(item.status || '').toUpperCase() === 'LOW_STOCK'),
    [inventoryRows]
  );

  const outOfStockRows = useMemo(
    () => inventoryRows.filter((item) => String(item.status || '').toUpperCase() === 'OUT_OF_STOCK'),
    [inventoryRows]
  );

  const statCards = useMemo<StatCard[]>(() => {
    if (role === 'manager') {
      return [
        { id: 'pending-requests', label: 'طلبات بانتظار الإجراء', value: requestPending.length, href: '/requests', tone: requestPending.length ? 'warning' : 'default' },
        { id: 'pending-returns', label: 'إرجاعات بانتظار الاستلام', value: pendingReturns.length, href: '/returns', tone: pendingReturns.length ? 'warning' : 'default' },
        { id: 'overdue-custody', label: 'عهد متأخرة', value: overdueCustody.length, href: '/custody', tone: overdueCustody.length ? 'danger' : 'default' },
        { id: 'low-stock', label: 'مواد منخفضة', value: lowStockRows.length + outOfStockRows.length, href: '/inventory', tone: lowStockRows.length + outOfStockRows.length ? 'danger' : 'default' },
      ];
    }

    if (role === 'warehouse') {
      return [
        { id: 'pending-requests', label: 'طلبات تنتظر الصرف', value: requestPending.length, href: '/requests', tone: requestPending.length ? 'warning' : 'default' },
        { id: 'pending-returns', label: 'إرجاعات تنتظر الاستلام', value: pendingReturns.length, href: '/returns', tone: pendingReturns.length ? 'warning' : 'default' },
        { id: 'low-stock', label: 'مواد تحتاج متابعة', value: lowStockRows.length + outOfStockRows.length, href: '/inventory', tone: lowStockRows.length + outOfStockRows.length ? 'danger' : 'default' },
        { id: 'issued', label: 'طلبات مصروفة', value: requestIssued.length, href: '/requests', tone: requestIssued.length ? 'success' : 'default' },
      ];
    }

    return [
      { id: 'my-pending', label: 'طلباتي الجارية', value: requestPending.length, href: '/requests', tone: requestPending.length ? 'warning' : 'default' },
      { id: 'my-custody', label: 'عهدتي الحالية', value: openCustody.length, href: '/custody', tone: openCustody.length ? 'primary' : 'default' },
      { id: 'due-soon', label: 'قريبة الإرجاع', value: dueSoonCustody.length, href: '/custody', tone: dueSoonCustody.length ? 'warning' : 'default' },
      { id: 'notifications', label: 'إشعارات غير مقروءة', value: unreadNotifications.length, href: '/notifications', tone: unreadNotifications.length ? 'primary' : 'default' },
    ];
  }, [role, requestPending.length, pendingReturns.length, overdueCustody.length, lowStockRows.length, outOfStockRows.length, requestIssued.length, openCustody.length, dueSoonCustody.length, unreadNotifications.length]);

  const currentWork = useMemo<FocusRow[]>(() => {
    if (role === 'manager') {
      return [
        requestPending.length > 0
          ? {
              id: 'manager-pending-requests',
              title: 'مراجعة تدفق الصرف الحالي',
              note: `${requestPending.length} طلب بانتظار الإجراء التشغيلي الآن`,
              href: '/requests',
              level: 'warning',
            }
          : {
              id: 'manager-healthy-flow',
              title: 'التدفق التشغيلي مستقر',
              note: 'لا توجد طلبات صرف متراكمة في الوقت الحالي',
              href: '/requests',
              level: 'normal',
            },
        pendingReturns.length > 0
          ? {
              id: 'manager-returns',
              title: 'متابعة الإرجاعات المفتوحة',
              note: `${pendingReturns.length} طلب إرجاع يحتاج استلامًا أو إغلاقًا`,
              href: '/returns',
              level: 'warning',
            }
          : {
              id: 'manager-no-returns',
              title: 'الإرجاعات تحت السيطرة',
              note: 'لا توجد إرجاعات مفتوحة تحتاج متابعة عاجلة',
              href: '/returns',
              level: 'normal',
            },
        lowStockRows.length + outOfStockRows.length > 0
          ? {
              id: 'manager-stock',
              title: 'مراجعة المواد الحرجة',
              note: `${lowStockRows.length + outOfStockRows.length} مادة تحتاج قرار متابعة أو شراء`,
              href: '/inventory',
              level: 'critical',
            }
          : {
              id: 'manager-stock-ok',
              title: 'وضع المخزون مستقر',
              note: 'لا توجد مواد حرجة تستدعي تدخلًا فوريًا',
              href: '/inventory',
              level: 'normal',
            },
      ];
    }

    if (role === 'warehouse') {
      return [
        requestPending.length > 0
          ? {
              id: 'warehouse-issue',
              title: 'ابدأ بصرف الطلبات الجديدة',
              note: `${requestPending.length} طلب جديد بانتظار الصرف الآن`,
              href: '/requests',
              level: 'warning',
            }
          : {
              id: 'warehouse-no-requests',
              title: 'لا توجد طلبات صرف حالية',
              note: 'يمكنك متابعة المخزون والإرجاعات المفتوحة',
              href: '/requests',
              level: 'normal',
            },
        pendingReturns.length > 0
          ? {
              id: 'warehouse-returns',
              title: 'استلام الإرجاعات المفتوحة',
              note: `${pendingReturns.length} طلب إرجاع بانتظار الاستلام والتوثيق`,
              href: '/returns',
              level: 'warning',
            }
          : {
              id: 'warehouse-no-returns',
              title: 'لا توجد إرجاعات بانتظارك',
              note: 'مسار الإرجاع مستقر حاليًا',
              href: '/returns',
              level: 'normal',
            },
        lowStockRows.length + outOfStockRows.length > 0
          ? {
              id: 'warehouse-stock',
              title: 'مواد تحتاج متابعة مخزنية',
              note: `${lowStockRows.length + outOfStockRows.length} مادة منخفضة أو نافدة`,
              href: '/inventory',
              level: 'critical',
            }
          : {
              id: 'warehouse-stock-ok',
              title: 'المخزون اليومي مستقر',
              note: 'لا توجد مواد منخفضة تتطلب تدخلًا مباشرًا',
              href: '/inventory',
              level: 'normal',
            },
      ];
    }

    return [
      requestPending.length > 0
        ? {
            id: 'employee-pending',
            title: 'متابعة طلباتك الجارية',
            note: `${requestPending.length} طلب لم يُحسم بعد`,
            href: '/requests',
            level: 'warning',
          }
        : {
            id: 'employee-clear',
            title: 'طلباتك مستقرة',
            note: 'لا توجد طلبات مفتوحة تحتاج متابعة الآن',
            href: '/requests',
            level: 'normal',
          },
      openCustody.length > 0
        ? {
            id: 'employee-custody',
            title: 'مراجعة العهدة الحالية',
            note: `${openCustody.length} مادة بعهدتك الآن`,
            href: '/custody',
            level: 'primary',
          }
        : {
            id: 'employee-no-custody',
            title: 'لا توجد عهدة مفتوحة',
            note: 'ليس لديك مواد مفتوحة في العهدة حاليًا',
            href: '/custody',
            level: 'normal',
          },
      dueSoonCustody.length > 0 || overdueCustody.length > 0
        ? {
            id: 'employee-return',
            title: 'متابعة مواعيد الإرجاع',
            note: overdueCustody.length > 0
              ? `${overdueCustody.length} مادة تجاوزت موعد الإرجاع`
              : `${dueSoonCustody.length} مادة اقترب موعد إرجاعها`,
            href: '/returns',
            level: overdueCustody.length > 0 ? 'critical' : 'warning',
          }
        : {
            id: 'employee-return-ok',
            title: 'مواعيد الإرجاع مستقرة',
            note: 'لا توجد مواد متأخرة أو قريبة الإرجاع',
            href: '/returns',
            level: 'normal',
          },
    ];
  }, [role, requestPending.length, pendingReturns.length, lowStockRows.length, outOfStockRows.length, openCustody.length, dueSoonCustody.length, overdueCustody.length]);

  const directIntervention = useMemo<FocusRow[]>(() => {
    if (role === 'manager') {
      const rows: FocusRow[] = [];

      if (requestPending.length > 5) {
        rows.push({
          id: 'manager-backlog',
          title: 'تراكم في طلبات الصرف',
          note: `${requestPending.length} طلب بانتظار الإجراء؛ يستدعي تدخلاً إداريًا لتسريع المسار`,
          href: '/requests',
          level: 'critical',
        });
      }

      if (pendingReturns.length > 3) {
        rows.push({
          id: 'manager-return-backlog',
          title: 'تراكم في الإرجاعات',
          note: `${pendingReturns.length} طلب إرجاع بانتظار الاستلام`,
          href: '/returns',
          level: 'warning',
        });
      }

      if (overdueCustody.length > 0) {
        rows.push({
          id: 'manager-overdue',
          title: 'عهد متأخرة تحتاج قرارًا',
          note: `${overdueCustody.length} مادة تجاوزت موعد الإرجاع المحدد`,
          href: '/custody',
          level: 'critical',
        });
      }

      if (outOfStockRows.length > 0) {
        rows.push({
          id: 'manager-stockout',
          title: 'مواد نافدة تؤثر على التشغيل',
          note: `${outOfStockRows.length} مادة نافدة الآن وتحتاج قرار معالجة`,
          href: '/inventory',
          level: 'critical',
        });
      }

      if (lowStockRows.length > 0) {
        rows.push({
          id: 'manager-low-stock',
          title: 'مواد منخفضة تحتاج متابعة',
          note: `${lowStockRows.length} مادة منخفضة دون حد الأمان`,
          href: '/inventory',
          level: 'warning',
        });
      }

      return rows.length > 0
        ? rows.slice(0, 6)
        : [
            {
              id: 'manager-no-direct-action',
              title: 'لا توجد عناصر تستدعي قرارًا مباشرًا الآن',
              note: 'الوضع التشغيلي مستقر في الطلبات والإرجاعات والمخزون',
              href: '/dashboard',
              level: 'normal',
            },
          ];
    }

    if (role === 'warehouse') {
      const rows: FocusRow[] = [];

      if (requestPending.length > 0) {
        rows.push({
          id: 'warehouse-pending-requests',
          title: 'طلبات تنتظر الصرف',
          note: `${requestPending.length} طلب يحتاج تنفيذًا مباشرًا`,
          href: '/requests',
          level: 'warning',
        });
      }

      if (pendingReturns.length > 0) {
        rows.push({
          id: 'warehouse-pending-returns',
          title: 'إرجاعات تنتظر الاستلام',
          note: `${pendingReturns.length} طلب إرجاع يحتاج توثيقًا وإغلاقًا`,
          href: '/returns',
          level: 'warning',
        });
      }

      if (lowStockRows.length + outOfStockRows.length > 0) {
        rows.push({
          id: 'warehouse-stock-risk',
          title: 'مواد تحتاج تدخلاً مخزنيًا',
          note: `${lowStockRows.length + outOfStockRows.length} مادة منخفضة أو نافدة`,
          href: '/inventory',
          level: 'critical',
        });
      }

      return rows.length > 0
        ? rows.slice(0, 6)
        : [
            {
              id: 'warehouse-no-direct-action',
              title: 'لا توجد عناصر ضاغطة الآن',
              note: 'يمكنك متابعة الأعمال اليومية المعتادة دون تراكمات',
              href: '/dashboard',
              level: 'normal',
            },
          ];
    }

    const rows: FocusRow[] = [];

    if (rejectedRequests.length > 0) {
      rows.push({
        id: 'employee-rejected',
        title: 'طلبات مرفوضة تحتاج مراجعة',
        note: `${rejectedRequests.length} طلب يحتاج الاطلاع على سبب الرفض`,
        href: '/requests',
        level: 'warning',
      });
    }

    if (overdueCustody.length > 0) {
      rows.push({
        id: 'employee-overdue',
        title: 'عهد متأخرة تستدعي إجراءك',
        note: `${overdueCustody.length} مادة تجاوزت موعد الإرجاع`,
        href: '/returns',
        level: 'critical',
      });
    }

    if (unreadNotifications.length > 0) {
      rows.push({
        id: 'employee-unread',
        title: 'إشعارات غير مقروءة',
        note: `${unreadNotifications.length} إشعار يحتاج اطلاعك الآن`,
        href: '/notifications',
        level: 'primary',
      });
    }

    return rows.length > 0
      ? rows.slice(0, 6)
      : [
          {
            id: 'employee-no-direct-action',
            title: 'لا يوجد ما يستدعي تدخلك الآن',
            note: 'طلبك وعهدتك وإشعاراتك في وضع مستقر',
            href: '/dashboard',
            level: 'normal',
          },
        ];
  }, [role, requestPending.length, pendingReturns.length, overdueCustody.length, outOfStockRows.length, lowStockRows.length, rejectedRequests.length, unreadNotifications.length]);

  const dailyTasks = useMemo<FocusRow[]>(() => {
    if (role === 'manager') {
      return [
        {
          id: 'manager-task-1',
          title: 'مراجعة المشهد التشغيلي اليومي',
          note: `طلبات جديدة: ${requestPending.length} | إرجاعات مفتوحة: ${pendingReturns.length}`,
          href: '/dashboard',
          level: 'secondary',
        },
        {
          id: 'manager-task-2',
          title: 'متابعة المواد الحرجة',
          note: `منخفضة: ${lowStockRows.length} | نافدة: ${outOfStockRows.length}`,
          href: '/inventory',
          level: lowStockRows.length + outOfStockRows.length > 0 ? 'warning' : 'secondary',
        },
        {
          id: 'manager-task-3',
          title: 'متابعة العهد المفتوحة',
          note: `عهد نشطة: ${openCustody.length} | متأخرة: ${overdueCustody.length}`,
          href: '/custody',
          level: overdueCustody.length > 0 ? 'warning' : 'secondary',
        },
      ];
    }

    if (role === 'warehouse') {
      return [
        {
          id: 'warehouse-task-1',
          title: 'صرف الطلبات الجديدة',
          note: `${requestPending.length} طلب بانتظار الصرف الآن`,
          href: '/requests',
          level: requestPending.length > 0 ? 'warning' : 'secondary',
        },
        {
          id: 'warehouse-task-2',
          title: 'استلام الإرجاعات المفتوحة',
          note: `${pendingReturns.length} طلب إرجاع بانتظار الاستلام`,
          href: '/returns',
          level: pendingReturns.length > 0 ? 'warning' : 'secondary',
        },
        {
          id: 'warehouse-task-3',
          title: 'مراجعة حالة المخزون',
          note: `مواد منخفضة/نافدة: ${lowStockRows.length + outOfStockRows.length}`,
          href: '/inventory',
          level: lowStockRows.length + outOfStockRows.length > 0 ? 'warning' : 'secondary',
        },
      ];
    }

    return [
      {
        id: 'employee-task-1',
        title: 'متابعة طلباتك الجارية',
        note: `${requestPending.length} طلب بانتظار الإجراء`,
        href: '/requests',
        level: requestPending.length > 0 ? 'warning' : 'secondary',
      },
      {
        id: 'employee-task-2',
        title: 'مراجعة عهدتك الحالية',
        note: `${openCustody.length} مادة بعهدتك`,
        href: '/custody',
        level: openCustody.length > 0 ? 'primary' : 'secondary',
      },
      {
        id: 'employee-task-3',
        title: 'الاطلاع على الإشعارات والمراسلات',
        note: `${unreadNotifications.length} إشعار غير مقروء`,
        href: '/notifications',
        level: unreadNotifications.length > 0 ? 'warning' : 'secondary',
      },
    ];
  }, [role, requestPending.length, pendingReturns.length, lowStockRows.length, outOfStockRows.length, openCustody.length, overdueCustody.length, unreadNotifications.length]);

  const recentNotifications = useMemo(
    () => notifications.slice(0, 5),
    [notifications]
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[1.25] text-primary sm:text-[30px]">
              {role === 'manager'
                ? 'لوحة القيادة الإدارية'
                : role === 'warehouse'
                ? 'لوحة مسؤول المخزن'
                : 'لوحة الموظف'}
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-surface-subtle sm:text-[14px]">
              {role === 'manager'
                ? 'صورة مركزة لما يحتاج قرارًا أو متابعة إدارية مباشرة الآن.'
                : role === 'warehouse'
                ? 'ملخص يومي لما يحتاج تنفيذًا أو متابعة تشغيلية مباشرة.'
                : 'ملخص واضح لما يحتاج متابعتك الآن من طلبات وعهدة وإشعارات.'}
            </p>
          </div>

          <Link
            href="/notifications"
            className="inline-flex h-10 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm text-[#016564] shadow-soft transition hover:border-[#016564]/20 hover:bg-[#f7fbfa]"
          >
            فتح الإشعارات
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4 sm:mt-5 sm:gap-4">
          {statCards.map((card) => (
            <Link key={card.id} href={card.href}>
              <Card className={`rounded-[20px] border p-3 transition hover:-translate-y-0.5 hover:shadow-soft sm:rounded-[22px] sm:p-4 ${toneClasses(card.tone)}`}>
                <div className="text-[12px] sm:text-[13px]">{card.label}</div>
                <div className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">{card.value}</div>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      <Card className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <SectionHeader
          title={role === 'manager' ? 'ما الذي يحتاج قراري الآن؟' : role === 'warehouse' ? 'ما الذي أعمل عليه الآن؟' : 'ما الذي يجب متابعته الآن؟'}
          subtitle={role === 'manager'
            ? 'عناصر مختصرة تستحق انتباهك الإداري المباشر الآن.'
            : role === 'warehouse'
            ? 'أولويات التشغيل الحالية لمسؤول المخزن.'
            : 'أقرب عناصر تتطلب تحركك المباشر الآن.'}
          actionHref={role === 'manager' ? '/dashboard' : role === 'warehouse' ? '/requests' : '/requests'}
          actionLabel="فتح التفاصيل"
        />

        <div className="grid gap-3 xl:grid-cols-3 sm:gap-4">
          {currentWork.map((row) => (
            <Link key={row.id} href={row.href}>
              <Card className={`rounded-[22px] border p-4 transition hover:-translate-y-0.5 hover:shadow-soft ${levelClasses(row.level)}`}>
                <div className="text-[16px] font-bold text-slate-900">{row.title}</div>
                <div className="mt-2 text-[13px] leading-7 text-slate-600">{row.note}</div>
              </Card>
            </Link>
          ))}
        </div>
      </Card>

      <Card className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <SectionHeader
          title={role === 'manager' ? 'أهم العناصر التي تستدعي تدخلًا إداريًا مباشرًا' : role === 'warehouse' ? 'أهم العناصر التي تستدعي تدخلًا مباشرًا' : 'عناصر تتطلب إجراء منك'}
          subtitle={role === 'manager'
            ? 'لا يظهر هنا إلا ما يحمل مخاطرة أو تراكمًا أو يحتاج قرارًا حاسمًا.'
            : role === 'warehouse'
            ? 'عناصر التشغيل التي لا ينبغي تأجيلها الآن.'
            : 'الأشياء التي يجب أن تتعامل معها الآن قبل غيرها.'}
          actionHref={role === 'manager' ? '/dashboard' : role === 'warehouse' ? '/inventory' : '/notifications'}
          actionLabel="عرض الكل"
        />

        <div className="grid gap-3 xl:grid-cols-2 sm:gap-4">
          {directIntervention.map((row) => (
            <Link key={row.id} href={row.href}>
              <Card className={`rounded-[22px] border p-4 transition hover:-translate-y-0.5 hover:shadow-soft ${levelClasses(row.level)}`}>
                <div className="text-[16px] font-bold text-slate-900">{row.title}</div>
                <div className="mt-2 text-[13px] leading-7 text-slate-600">{row.note}</div>
              </Card>
            </Link>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionHeader
            title={role === 'warehouse' ? 'المهام الأساسية اليومية لمسؤول المخزن' : role === 'manager' ? 'المهام الأساسية اليومية' : 'المهام الأساسية اليومية'}
            subtitle="بطاقات يومية مختصرة تساعد على معرفة الخطوة التالية مباشرة."
          />

          <div className="space-y-3">
            {dailyTasks.map((task) => (
              <Link key={task.id} href={task.href}>
                <div className={`rounded-[20px] border p-4 transition hover:-translate-y-0.5 hover:shadow-soft ${levelClasses(task.level)}`}>
                  <div className="text-[15px] font-bold text-slate-900">{task.title}</div>
                  <div className="mt-2 text-[13px] leading-7 text-slate-600">{task.note}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
          <SectionHeader
            title="أحدث ما وصلك"
            subtitle="آخر الإشعارات الواردة من النظام والمراسلات."
            actionHref="/notifications"
            actionLabel="صفحة الإشعارات"
          />

          <div className="space-y-3">
            {loading ? (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                جارٍ تحميل البيانات...
              </div>
            ) : recentNotifications.length === 0 ? (
              <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                لا توجد إشعارات حديثة
              </div>
            ) : (
              recentNotifications.map((item) => (
                <Link key={item.id} href="/notifications">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4 transition hover:-translate-y-0.5 hover:shadow-soft">
                    <div className="text-[14px] font-bold text-slate-900">{item.title}</div>
                    <div className="mt-2 line-clamp-2 text-[13px] leading-7 text-slate-600">{item.message}</div>
                    <div className="mt-2 text-[11px] text-slate-400">{formatRelative(item.createdAt)}</div>
                  </div>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
