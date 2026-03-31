
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';

type AppRole = 'manager' | 'warehouse' | 'user';

type RequestStatus = 'PENDING' | 'REJECTED' | 'ISSUED' | 'RETURNED' | string;
type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;
type CustodyStatus = 'ACTIVE' | 'RETURN_REQUESTED' | 'RETURNED' | string;
type InventoryStatus = 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK' | string;
type SuggestionStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | string;

type RequestRow = {
  id: string;
  code?: string | null;
  status: RequestStatus;
  createdAt?: string | null;
  requesterId?: string | null;
};

type ReturnRow = {
  id: string;
  code?: string | null;
  status: ReturnStatus;
  createdAt?: string | null;
  requesterId?: string | null;
};

type CustodyRow = {
  id: string;
  code?: string | null;
  status: CustodyStatus;
  assignedToUserId?: string | null;
  dueDate?: string | null;
  assignedDate?: string | null;
};

type InventoryRow = {
  id: string;
  code?: string | null;
  name?: string | null;
  quantity?: number | null;
  availableQty?: number | null;
  status?: InventoryStatus | null;
};

type NotificationRow = {
  id: string;
  title: string;
  message: string;
  isRead?: boolean;
  createdAt?: string | null;
};

type SuggestionRow = {
  id: string;
  title?: string | null;
  category?: string | null;
  status?: SuggestionStatus | null;
  requesterId?: string | null;
  createdAt?: string | null;
};

type Metric = {
  label: string;
  value: number;
  note: string;
  href: string;
};

type ActionItem = {
  title: string;
  count: number;
  note: string;
  href: string;
  tone: 'critical' | 'warning' | 'normal';
};

type QuickLink = {
  label: string;
  href: string;
  icon: 'requests' | 'returns' | 'custody' | 'inventory' | 'maintenance' | 'purchase' | 'cleaning' | 'other' | 'notifications' | 'users';
};

type Snapshot = {
  requests: RequestRow[];
  returns: ReturnRow[];
  custody: CustodyRow[];
  inventory: InventoryRow[];
  suggestions: SuggestionRow[];
  notifications: NotificationRow[];
};

const emptySnapshot: Snapshot = {
  requests: [],
  returns: [],
  custody: [],
  inventory: [],
  suggestions: [],
  notifications: [],
};

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

async function fetchCollection<T>(url: string): Promise<T[]> {
  try {
    const response = await fetch(url, {
      credentials: 'include',
      cache: 'no-store',
    });

    if (!response.ok) return [];

    const json = await response.json().catch(() => ({}));
    if (Array.isArray(json?.data)) return json.data as T[];
    if (Array.isArray(json)) return json as T[];
    return [];
  } catch {
    return [];
  }
}

function daysUntil(date?: string | null) {
  if (!date) return null;
  const due = new Date(date);
  if (Number.isNaN(due.getTime())) return null;
  const today = new Date();
  const diff = due.getTime() - today.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

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

function categoryMatch(category: string | null | undefined, expected: string) {
  return String(category || '').trim().toUpperCase() === expected;
}

function Icon({ name, className = 'h-5 w-5' }: { name: QuickLink['icon']; className?: string }) {
  const props = { className, viewBox: '0 0 24 24', fill: 'none' } as const;

  switch (name) {
    case 'inventory':
      return <svg {...props}><path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case 'requests':
      return <svg {...props}><path d="M7 4h7l3 3v13H7V4Z" stroke="currentColor" strokeWidth="1.8" /><path d="M14 4v4h4" stroke="currentColor" strokeWidth="1.8" /><path d="M10 12h4M10 16h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case 'returns':
      return <svg {...props}><path d="M8 8H5V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /><path d="M5 8c1.8-2.4 4-3.5 7-3.5 4.7 0 8 3.3 8 8s-3.3 8-8 8c-3.3 0-5.8-1.3-7.5-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case 'custody':
      return <svg {...props}><path d="M4 7.5 12 3l8 4.5-8 4.5L4 7.5Z" stroke="currentColor" strokeWidth="1.8" /><path d="M4 7.5V16.5L12 21l8-4.5V7.5" stroke="currentColor" strokeWidth="1.8" /><path d="M12 12v9" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case 'maintenance':
      return <svg {...props}><path d="m14.7 6.3 3 3-8.4 8.4H6.3v-3L14.7 6.3Z" stroke="currentColor" strokeWidth="1.8" /><path d="m13.3 7.7 3 3" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case 'purchase':
      return <svg {...props}><path d="M6 7h13l-1.2 6.2a2 2 0 0 1-2 1.6H9.3a2 2 0 0 1-2-1.6L6 7Z" stroke="currentColor" strokeWidth="1.8" /><path d="M6 7 5.2 5.3A1.5 1.5 0 0 0 3.8 4.5H3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="10" cy="18.5" r="1.2" fill="currentColor" /><circle cx="17" cy="18.5" r="1.2" fill="currentColor" /></svg>;
    case 'cleaning':
      return <svg {...props}><path d="M7 21h10" stroke="currentColor" strokeWidth="1.8" /><path d="M12 3v12" stroke="currentColor" strokeWidth="1.8" /><path d="m8 7 4-4 4 4" stroke="currentColor" strokeWidth="1.8" /><path d="M8 15h8" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case 'other':
      return <svg {...props}><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1.1-1.5 2" stroke="currentColor" strokeWidth="1.8" /><path d="M12 17h.01" stroke="currentColor" strokeWidth="1.8" /></svg>;
    case 'notifications':
      return <svg {...props}><path d="M6 16.5h12l-1.5-2V10a4.5 4.5 0 1 0-9 0v4.5l-1.5 2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M10 19a2 2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    case 'users':
      return <svg {...props}><circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.8" /><path d="M5 19c1.5-2.8 4-4.2 7-4.2S17.5 16.2 19 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
    default:
      return null;
  }
}

function SectionTitle({ title, note }: { title: string; note?: string }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h2 className="text-[18px] font-bold text-[#016564] sm:text-[20px]">{title}</h2>
        {note ? <p className="mt-1 text-[12px] leading-6 text-slate-500 sm:text-[13px]">{note}</p> : null}
      </div>
    </div>
  );
}

function MetricCard({ metric }: { metric: Metric }) {
  return (
    <Link href={metric.href} className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft transition hover:-translate-y-0.5 hover:border-[#c9ddda] hover:shadow-md sm:p-5">
      <div className="text-[12px] text-slate-500">{metric.label}</div>
      <div className="mt-3 text-[30px] font-bold leading-none text-slate-900">{metric.value}</div>
      <div className="mt-3 text-[12px] leading-6 text-slate-500">{metric.note}</div>
    </Link>
  );
}

function ActionCard({ item }: { item: ActionItem }) {
  const toneMap = {
    critical: 'border-[#f1c8c8] bg-[#fff7f7]',
    warning: 'border-[#ead9b0] bg-[#fffaf0]',
    normal: 'border-[#d7e7e4] bg-[#fbfdfd]',
  } as const;

  return (
    <Link href={item.href} className={`rounded-[22px] border p-4 shadow-soft transition hover:-translate-y-0.5 hover:shadow-md ${toneMap[item.tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[15px] font-semibold text-slate-900">{item.title}</div>
          <div className="mt-1 text-[12px] leading-6 text-slate-500">{item.note}</div>
        </div>
        <div className="rounded-full bg-white px-3 py-1 text-[13px] font-bold text-[#016564] shadow-sm">{item.count}</div>
      </div>
    </Link>
  );
}

function QuickLinkCard({ item }: { item: QuickLink }) {
  return (
    <Link href={item.href} className="group rounded-[20px] border border-[#e0ebe9] bg-[#fbfdfd] p-3.5 transition hover:border-[#c6dad7] hover:bg-white hover:shadow-md sm:p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="rounded-[18px] bg-[#016564]/8 p-2.5 text-[#016564] sm:p-3">
          <Icon name={item.icon} className="h-5 w-5" />
        </div>
        <svg className="h-4 w-4 text-slate-400 transition group-hover:text-[#016564]" viewBox="0 0 24 24" fill="none">
          <path d="m9 5 7 7-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="mt-3 text-[14px] text-slate-900 sm:mt-4 sm:text-[15px]">{item.label}</div>
    </Link>
  );
}

function MiniBarChart({ title, items }: { title: string; items: { label: string; value: number }[] }) {
  const max = Math.max(1, ...items.map((item) => item.value));
  return (
    <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:p-5">
      <SectionTitle title={title} />
      <div className="space-y-3">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-1 flex items-center justify-between gap-3">
              <span className="text-[13px] text-slate-600">{item.label}</span>
              <span className="text-[13px] font-semibold text-slate-900">{item.value}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-[#edf4f3]">
              <div className="h-full rounded-full bg-[#016564]" style={{ width: `${(item.value / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function RecentList({ title, items }: { title: string; items: NotificationRow[] }) {
  return (
    <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:p-5">
      <SectionTitle title={title} />
      <div className="space-y-3">
        {items.length === 0 ? (
          <div className="rounded-[18px] bg-[#f8fbfb] px-4 py-6 text-center text-[13px] text-slate-500">لا يوجد جديد حاليًا</div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="rounded-[18px] border border-[#eef4f3] bg-[#fbfdfd] p-3.5">
              <div className="text-[14px] font-semibold text-slate-900">{item.title}</div>
              <div className="mt-1 text-[12px] leading-6 text-slate-600">{item.message}</div>
              <div className="mt-2 text-[11px] text-slate-400">{formatRelative(item.createdAt)}</div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

function DashboardPageContent() {
  const { user } = useAuth();
  const role = ((user?.role || 'user').toLowerCase() as AppRole);
  const userId = user?.id || '';

  const [snapshot, setSnapshot] = useState<Snapshot>(emptySnapshot);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      const [requests, returns, custody, inventory, suggestions, notifications] = await Promise.all([
        fetchCollection<RequestRow>('/api/requests'),
        fetchCollection<ReturnRow>('/api/returns'),
        fetchCollection<CustodyRow>('/api/custody'),
        fetchCollection<InventoryRow>('/api/inventory'),
        fetchCollection<SuggestionRow>('/api/suggestions'),
        fetchCollection<NotificationRow>('/api/notifications'),
      ]);

      if (!mounted) return;

      setSnapshot({
        requests,
        returns,
        custody,
        inventory,
        suggestions,
        notifications,
      });
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [userId, role]);

  const view = useMemo(() => {
    const myRequests = snapshot.requests.filter((item) => !userId || item.requesterId === userId);
    const myReturns = snapshot.returns.filter((item) => !userId || item.requesterId === userId);
    const myCustody = snapshot.custody.filter((item) => !userId || item.assignedToUserId === userId);
    const mySuggestions = snapshot.suggestions.filter((item) => !userId || item.requesterId === userId);

    const pendingRequests = snapshot.requests.filter((item) => item.status === 'PENDING').length;
    const issuedRequests = snapshot.requests.filter((item) => item.status === 'ISSUED').length;
    const rejectedRequests = snapshot.requests.filter((item) => item.status === 'REJECTED').length;

    const pendingReturns = snapshot.returns.filter((item) => item.status === 'PENDING').length;
    const activeCustody = snapshot.custody.filter((item) => item.status === 'ACTIVE').length;
    const overdueCustody = snapshot.custody.filter((item) => {
      const remaining = daysUntil(item.dueDate);
      return item.status === 'ACTIVE' && remaining !== null && remaining < 0;
    }).length;

    const lowStock = snapshot.inventory.filter((item) => item.status === 'LOW_STOCK').length;
    const outOfStock = snapshot.inventory.filter((item) => item.status === 'OUT_OF_STOCK').length;

    const maintenanceOpen = snapshot.suggestions.filter((item) => categoryMatch(item.category, 'MAINTENANCE') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const cleaningOpen = snapshot.suggestions.filter((item) => categoryMatch(item.category, 'CLEANING') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const purchaseOpen = snapshot.suggestions.filter((item) => categoryMatch(item.category, 'PURCHASE') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const otherOpen = snapshot.suggestions.filter((item) => categoryMatch(item.category, 'OTHER') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;

    if (role === 'manager') {
      return {
        metrics: [
          { label: 'طلبات جديدة', value: pendingRequests, note: 'بانتظار الصرف أو المعالجة', href: '/requests' },
          { label: 'إرجاعات مفتوحة', value: pendingReturns, note: 'بانتظار الاستلام', href: '/returns' },
          { label: 'عهد متأخرة', value: overdueCustody, note: 'تحتاج متابعة مباشرة', href: '/custody' },
          { label: 'مواد منخفضة/نافدة', value: lowStock + outOfStock, note: 'تؤثر على الجاهزية', href: '/inventory' },
          { label: 'صيانة مفتوحة', value: maintenanceOpen, note: 'طلبات تحتاج تدخلًا', href: '/suggestions?category=MAINTENANCE' },
          { label: 'شراء مباشر مفتوح', value: purchaseOpen, note: 'طلبات بانتظار قرار', href: '/purchases' },
        ] as Metric[],
        actions: [
          { title: 'طلبات صرف تحتاج قرارًا أو متابعة', count: pendingRequests, note: 'طلبات مواد جديدة لم تُنه بعد', href: '/requests', tone: pendingRequests > 0 ? 'warning' : 'normal' },
          { title: 'إرجاعات بانتظار الاستلام', count: pendingReturns, note: 'تحتاج توجيهًا ومتابعة تشغيلية', href: '/returns', tone: pendingReturns > 0 ? 'warning' : 'normal' },
          { title: 'عهد متأخرة', count: overdueCustody, note: 'تجاوزت تاريخ الإرجاع', href: '/custody', tone: overdueCustody > 0 ? 'critical' : 'normal' },
          { title: 'مواد منخفضة أو نافدة', count: lowStock + outOfStock, note: 'قد تعطل التنفيذ القادم', href: '/inventory', tone: lowStock + outOfStock > 0 ? 'critical' : 'normal' },
          { title: 'طلبات النظافة المفتوحة', count: cleaningOpen, note: 'تحتاج معالجة ومتابعة', href: '/suggestions?category=CLEANING', tone: cleaningOpen > 0 ? 'warning' : 'normal' },
          { title: 'طلبات أخرى مفتوحة', count: otherOpen, note: 'تحتاج تصنيفًا أو قرارًا', href: '/suggestions?category=OTHER', tone: otherOpen > 0 ? 'warning' : 'normal' },
        ] as ActionItem[],
        quickLinks: [
          { label: 'الطلبات', href: '/requests', icon: 'requests' },
          { label: 'الإرجاعات', href: '/returns', icon: 'returns' },
          { label: 'المخزون', href: '/inventory', icon: 'inventory' },
          { label: 'الصيانة', href: '/maintenance', icon: 'maintenance' },
          { label: 'الشراء المباشر', href: '/purchases', icon: 'purchase' },
          { label: 'النظافة', href: '/suggestions?category=CLEANING', icon: 'cleaning' },
          { label: 'الطلبات الأخرى', href: '/suggestions?category=OTHER', icon: 'other' },
          { label: 'المستخدمون', href: '/users', icon: 'users' },
        ] as QuickLink[],
        chartA: [
          { label: 'طلبات جديدة', value: pendingRequests },
          { label: 'مصروفة', value: issuedRequests },
          { label: 'مرفوضة', value: rejectedRequests },
        ],
        chartB: [
          { label: 'صيانة', value: maintenanceOpen },
          { label: 'شراء مباشر', value: purchaseOpen },
          { label: 'نظافة', value: cleaningOpen },
          { label: 'أخرى', value: otherOpen },
        ],
        recent: snapshot.notifications.slice(0, 6),
      };
    }

    if (role === 'warehouse') {
      return {
        metrics: [
          { label: 'طلبات بانتظار الصرف', value: pendingRequests, note: 'أولوية التنفيذ الحالية', href: '/requests' },
          { label: 'إرجاعات بانتظار الاستلام', value: pendingReturns, note: 'تحتاج فحصًا واستلامًا', href: '/returns' },
          { label: 'مواد منخفضة', value: lowStock, note: 'اقتربت من حد الأمان', href: '/inventory' },
          { label: 'مواد نافدة', value: outOfStock, note: 'غير متاحة للصرف', href: '/inventory' },
          { label: 'صيانة مفتوحة', value: maintenanceOpen, note: 'قد تؤثر على جاهزية المواد', href: '/maintenance' },
          { label: 'شراء مباشر مفتوح', value: purchaseOpen, note: 'يعني تغطية نواقص تشغيلية', href: '/purchases' },
        ] as Metric[],
        actions: [
          { title: 'صرفات اليوم', count: pendingRequests, note: 'طلبات يجب تجهيزها الآن', href: '/requests', tone: pendingRequests > 0 ? 'warning' : 'normal' },
          { title: 'استلامات اليوم', count: pendingReturns, note: 'إرجاعات تحتاج إغلاقًا', href: '/returns', tone: pendingReturns > 0 ? 'warning' : 'normal' },
          { title: 'مواد منخفضة', count: lowStock, note: 'تحتاج مراقبة أو إعادة طلب', href: '/inventory', tone: lowStock > 0 ? 'warning' : 'normal' },
          { title: 'مواد نافدة', count: outOfStock, note: 'غير قابلة للتنفيذ حاليًا', href: '/inventory', tone: outOfStock > 0 ? 'critical' : 'normal' },
        ] as ActionItem[],
        quickLinks: [
          { label: 'الطلبات', href: '/requests', icon: 'requests' },
          { label: 'الإرجاعات', href: '/returns', icon: 'returns' },
          { label: 'المخزون', href: '/inventory', icon: 'inventory' },
          { label: 'الصيانة', href: '/maintenance', icon: 'maintenance' },
          { label: 'الشراء المباشر', href: '/purchases', icon: 'purchase' },
          { label: 'الإشعارات', href: '/notifications', icon: 'notifications' },
        ] as QuickLink[],
        chartA: [
          { label: 'جديد', value: pendingRequests },
          { label: 'مصروف', value: issuedRequests },
          { label: 'إرجاعات', value: pendingReturns },
        ],
        chartB: [
          { label: 'منخفض', value: lowStock },
          { label: 'نافد', value: outOfStock },
          { label: 'صيانة', value: maintenanceOpen },
        ],
        recent: snapshot.notifications.slice(0, 6),
      };
    }

    const myPendingRequests = myRequests.filter((item) => item.status === 'PENDING').length;
    const myIssuedRequests = myRequests.filter((item) => item.status === 'ISSUED').length;
    const myRejectedRequests = myRequests.filter((item) => item.status === 'REJECTED').length;
    const myPendingReturns = myReturns.filter((item) => item.status === 'PENDING').length;
    const myActiveCustody = myCustody.filter((item) => item.status === 'ACTIVE').length;
    const myOverdueCustody = myCustody.filter((item) => {
      const remaining = daysUntil(item.dueDate);
      return item.status === 'ACTIVE' && remaining !== null && remaining < 0;
    }).length;
    const myMaintenance = mySuggestions.filter((item) => categoryMatch(item.category, 'MAINTENANCE') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const myPurchase = mySuggestions.filter((item) => categoryMatch(item.category, 'PURCHASE') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const myCleaning = mySuggestions.filter((item) => categoryMatch(item.category, 'CLEANING') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;
    const myOther = mySuggestions.filter((item) => categoryMatch(item.category, 'OTHER') && item.status !== 'IMPLEMENTED' && item.status !== 'REJECTED').length;

    return {
      metrics: [
        { label: 'طلباتي الجديدة', value: myPendingRequests, note: 'بانتظار المعالجة', href: '/requests' },
        { label: 'طلباتي المصروفة', value: myIssuedRequests, note: 'تم صرفها فعليًا', href: '/requests' },
        { label: 'العهد النشطة', value: myActiveCustody, note: 'مواد بعهدتي', href: '/custody' },
        { label: 'طلبات الإرجاع', value: myPendingReturns, note: 'رفعتها ولم تُغلق بعد', href: '/returns' },
        { label: 'صيانة مفتوحة', value: myMaintenance, note: 'طلبات تخصني', href: '/maintenance' },
        { label: 'شراء مباشر/أخرى', value: myPurchase + myCleaning + myOther, note: 'طلبات خدمية أخرى', href: '/notifications' },
      ] as Metric[],
      actions: [
        { title: 'طلبات تحتاج متابعة', count: myPendingRequests, note: 'بانتظار إجراء من المخزن', href: '/requests', tone: myPendingRequests > 0 ? 'warning' : 'normal' },
        { title: 'عهد متأخرة عليّ', count: myOverdueCustody, note: 'تجاوزت الموعد المحدد', href: '/custody', tone: myOverdueCustody > 0 ? 'critical' : 'normal' },
        { title: 'إرجاعات مفتوحة', count: myPendingReturns, note: 'بانتظار الاستلام', href: '/returns', tone: myPendingReturns > 0 ? 'warning' : 'normal' },
        { title: 'طلبات مرفوضة', count: myRejectedRequests, note: 'تحتاج مراجعة أو إعادة تقديم', href: '/requests', tone: myRejectedRequests > 0 ? 'warning' : 'normal' },
      ] as ActionItem[],
      quickLinks: [
        { label: 'طلب مواد', href: '/requests', icon: 'requests' },
        { label: 'عهدتي', href: '/custody', icon: 'custody' },
        { label: 'الإرجاعات', href: '/returns', icon: 'returns' },
        { label: 'الصيانة', href: '/maintenance', icon: 'maintenance' },
        { label: 'النظافة', href: '/suggestions?category=CLEANING', icon: 'cleaning' },
        { label: 'طلبات أخرى', href: '/suggestions?category=OTHER', icon: 'other' },
        { label: 'الإشعارات', href: '/notifications', icon: 'notifications' },
      ] as QuickLink[],
      chartA: [
        { label: 'جديدة', value: myPendingRequests },
        { label: 'مصروفة', value: myIssuedRequests },
        { label: 'مرفوضة', value: myRejectedRequests },
      ],
      chartB: [
        { label: 'عهد نشطة', value: myActiveCustody },
        { label: 'إرجاعات', value: myPendingReturns },
        { label: 'متأخرة', value: myOverdueCustody },
      ],
      recent: snapshot.notifications.slice(0, 6),
    };
  }, [role, snapshot, userId]);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#dde8e6] bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[24px] font-bold text-[#016564] sm:text-[30px]">لوحة العمليات التشغيلية</h1>
            <p className="mt-2 text-[13px] leading-7 text-slate-500 sm:text-[14px]">
              أرقام مباشرة، إجراءات حالية، ووصول سريع لاتخاذ القرار أو تنفيذ المهمة دون ازدحام.
            </p>
          </div>
          <div className="rounded-[20px] border border-[#e7efed] bg-[#f8fbfb] px-4 py-3 text-[13px] leading-6 text-slate-600">
            {loading ? 'جارٍ تحميل البيانات...' : `الدور الحالي: ${role === 'manager' ? 'مدير' : role === 'warehouse' ? 'مسؤول المخزن' : 'موظف'}`}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {view.metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.35fr,0.95fr]">
        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:p-5">
          <SectionTitle title="داشبورد الإجراءات" note="هذه العناصر تتطلب تنفيذًا أو متابعة الآن." />
          <div className="grid gap-3 md:grid-cols-2">
            {view.actions.map((item) => (
              <ActionCard key={item.title} item={item} />
            ))}
          </div>
        </Card>

        <Card className="rounded-[22px] border border-[#dde8e6] bg-white p-4 shadow-soft sm:p-5">
          <SectionTitle title="وصول سريع" note="أقصر طريق إلى أكثر المسارات استخدامًا." />
          <div className="grid gap-3 grid-cols-2">
            {view.quickLinks.map((item) => (
              <QuickLinkCard key={item.label} item={item} />
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-3">
        <MiniBarChart title="ملخص الطلبات" items={view.chartA} />
        <MiniBarChart title="ملخص المتابعة الحالية" items={view.chartB} />
        <RecentList title="أحدث ما وصلك" items={view.recent} />
      </section>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardPageContent />;
}
