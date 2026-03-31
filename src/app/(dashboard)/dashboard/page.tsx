"use client";

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';

type AppRole = 'manager' | 'warehouse' | 'user';
type RequestStatus = 'PENDING' | 'REJECTED' | 'ISSUED' | 'RETURNED' | string;
type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | string;
type GenericStatus = string;

type RequestRow = {
  id: string;
  code?: string;
  status: RequestStatus;
  createdAt?: string;
  requesterId?: string;
  requester?: { fullName?: string; department?: string };
  items?: Array<{ quantity?: number; item?: { type?: string; availableQty?: number; name?: string } }>;
};

type ReturnRow = { id: string; code?: string; status: ReturnStatus; createdAt?: string; requesterId?: string; userId?: string; sourceType?: string; receivedType?: string | null };
type CustodyRow = { id: string; status: GenericStatus; dueDate?: string | null; expectedReturn?: string | null; assignedToUserId?: string; userId?: string; item?: { name?: string; code?: string } };
type NotificationRow = { id: string; title: string; message: string; isRead?: boolean; createdAt?: string; entityType?: string | null; type?: string | null };
type InventoryStats = { totalItems?: number; totalUnits?: number; lowStockCount?: number; outOfStockCount?: number; totalEstimatedValue?: number; returnableCount?: number; consumableCount?: number; availableCount?: number; usedCount?: number };
type InventoryItem = { id: string; name: string; code?: string; availableQty?: number; quantity?: number; status?: string; type?: string; category?: string };
type TicketRow = { id: string; title?: string; status?: GenericStatus; createdAt?: string; requesterId?: string; category?: string; priority?: string; };

type FocusItem = { title: string; count: number; hint: string; href: string; tone: 'critical' | 'warning' | 'info' | 'good' };
type QuickLink = { label: string; href: string; note: string };

const currency = new Intl.NumberFormat('ar-SA');

function normalizeArray<T = any>(json: any): T[] {
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json)) return json;
  return [];
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
  } catch { return '—'; }
}

function daysLate(date?: string | null) {
  if (!date) return 0;
  const diff = Date.now() - new Date(date).getTime();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function toneClasses(tone: FocusItem['tone']) {
  if (tone === 'critical') return 'border-[#7c1e3e]/20 bg-[#7c1e3e]/[0.05] text-[#7c1e3e]';
  if (tone === 'warning') return 'border-[#d0b284]/40 bg-[#d0b284]/[0.10] text-[#8b6a2b]';
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  return 'border-[#016564]/15 bg-[#016564]/[0.05] text-[#016564]';
}

function statCard(title: string, value: string | number, note: string, accent: string) {
  return { title, value, note, accent };
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role || 'user') as AppRole;
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [returns, setReturns] = useState<ReturnRow[]>([]);
  const [custody, setCustody] = useState<CustodyRow[]>([]);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [inventoryStats, setInventoryStats] = useState<InventoryStats>({});
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [maintenance, setMaintenance] = useState<TicketRow[]>([]);
  const [purchases, setPurchases] = useState<TicketRow[]>([]);
  const [suggestions, setSuggestions] = useState<TicketRow[]>([]);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      const headers = { 'x-active-role': user?.role || 'user' };
      const safeFetch = async (url: string) => {
        try {
          const res = await fetch(url, { cache: 'no-store', credentials: 'include', headers });
          return await res.json().catch(() => ({}));
        } catch { return {}; }
      };
      const [inventoryJson, requestsJson, returnsJson, custodyJson, notificationsJson, maintenanceJson, purchasesJson, suggestionsJson] = await Promise.all([
        safeFetch('/api/inventory?page=1&limit=200'),
        safeFetch('/api/requests?page=1'),
        safeFetch('/api/returns?page=1'),
        safeFetch('/api/custody'),
        safeFetch('/api/notifications'),
        safeFetch('/api/maintenance'),
        safeFetch('/api/purchases'),
        safeFetch('/api/suggestions'),
      ]);
      if (!mounted) return;
      setInventoryStats(inventoryJson?.stats || {});
      setInventoryItems(normalizeArray<InventoryItem>(inventoryJson));
      setRequests(normalizeArray<RequestRow>(requestsJson));
      setReturns(normalizeArray<ReturnRow>(returnsJson));
      setCustody(normalizeArray<CustodyRow>(custodyJson));
      setNotifications(normalizeArray<NotificationRow>(notificationsJson));
      setMaintenance(normalizeArray<TicketRow>(maintenanceJson));
      setPurchases(normalizeArray<TicketRow>(purchasesJson));
      setSuggestions(normalizeArray<TicketRow>(suggestionsJson));
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [user?.role]);

  const myId = user?.id || '';
  const myRequests = useMemo(() => requests.filter((item) => !myId || item.requesterId === myId), [requests, myId]);
  const myReturns = useMemo(() => returns.filter((item) => !myId || item.requesterId === myId || item.userId === myId), [returns, myId]);
  const myCustody = useMemo(() => custody.filter((item) => !myId || item.assignedToUserId === myId || item.userId === myId), [custody, myId]);
  const myMaintenance = useMemo(() => maintenance.filter((item) => !myId || item.requesterId === myId), [maintenance, myId]);
  const myPurchases = useMemo(() => purchases.filter((item) => !myId || item.requesterId === myId), [purchases, myId]);
  const mySuggestions = useMemo(() => suggestions.filter((item) => !myId || item.requesterId === myId), [suggestions, myId]);

  const lowStockItems = useMemo(() => inventoryItems.filter((item) => item.status === 'LOW_STOCK'), [inventoryItems]);
  const outOfStockItems = useMemo(() => inventoryItems.filter((item) => item.status === 'OUT_OF_STOCK'), [inventoryItems]);
  const pendingRequests = useMemo(() => requests.filter((item) => item.status === 'PENDING'), [requests]);
  const issuedRequests = useMemo(() => requests.filter((item) => item.status === 'ISSUED'), [requests]);
  const pendingReturns = useMemo(() => returns.filter((item) => item.status === 'PENDING'), [returns]);
  const activeCustody = useMemo(() => custody.filter((item) => item.status === 'ACTIVE' || item.status === 'RETURN_REQUESTED'), [custody]);
  const overdueCustody = useMemo(() => custody.filter((item) => daysLate(item.dueDate || item.expectedReturn) > 0 && item.status !== 'RETURNED'), [custody]);
  const openMaintenance = useMemo(() => maintenance.filter((item) => !['APPROVED','IMPLEMENTED','CLOSED','DONE','REJECTED'].includes(String(item.status).toUpperCase())), [maintenance]);
  const openPurchases = useMemo(() => purchases.filter((item) => !['APPROVED','COMPLETED','CLOSED','REJECTED'].includes(String(item.status).toUpperCase())), [purchases]);
  const openSuggestions = useMemo(() => suggestions.filter((item) => !['APPROVED','IMPLEMENTED','REJECTED','CLOSED'].includes(String(item.status).toUpperCase())), [suggestions]);
  const unreadNotifications = useMemo(() => notifications.filter((item) => !item.isRead), [notifications]);

  const metrics = useMemo(() => {
    if (role === 'manager') {
      return [
        statCard('إجمالي الأصناف', inventoryStats.totalItems || 0, 'عدد الأصناف المسجلة في المخزون', 'from-[#016564] to-[#0b8a84]'),
        statCard('منخفض المخزون', inventoryStats.lowStockCount || 0, 'أصناف تحت حد الأمان', 'from-[#d0b284] to-[#b78f52]'),
        statCard('نافد المخزون', inventoryStats.outOfStockCount || 0, 'أصناف تحتاج تدخلًا مباشرًا', 'from-[#7c1e3e] to-[#a33659]'),
        statCard('قيمة تقديرية', currency.format(inventoryStats.totalEstimatedValue || 0), 'إجمالي القيمة التقديرية', 'from-[#334155] to-[#64748b]'),
      ];
    }
    if (role === 'warehouse') {
      return [
        statCard('طلبات بانتظار الصرف', pendingRequests.length, 'طلبات تحتاج تنفيذًا الآن', 'from-[#016564] to-[#0b8a84]'),
        statCard('إرجاعات بانتظار الاستلام', pendingReturns.length, 'طلبات تحتاج استلامًا وتوثيقًا', 'from-[#d0b284] to-[#b78f52]'),
        statCard('منخفض المخزون', inventoryStats.lowStockCount || 0, 'أصناف يجب متابعتها اليوم', 'from-[#7c1e3e] to-[#a33659]'),
        statCard('وحدات متاحة', inventoryStats.totalUnits || 0, 'إجمالي الوحدات المتاحة في النظام', 'from-[#334155] to-[#64748b]'),
      ];
    }
    return [
      statCard('طلباتي الجديدة', myRequests.filter((item) => item.status === 'PENDING').length, 'طلبات بانتظار الصرف', 'from-[#016564] to-[#0b8a84]'),
      statCard('طلباتي المصروفة', myRequests.filter((item) => item.status === 'ISSUED').length, 'طلبات تم تنفيذها', 'from-[#d0b284] to-[#b78f52]'),
      statCard('عهدتي النشطة', myCustody.filter((item) => item.status !== 'RETURNED').length, 'مواد في عهدتك الآن', 'from-[#7c1e3e] to-[#a33659]'),
      statCard('إرجاعاتي المفتوحة', myReturns.filter((item) => item.status === 'PENDING').length, 'طلبات إرجاع بانتظار الإغلاق', 'from-[#334155] to-[#64748b]'),
    ];
  }, [role, inventoryStats, pendingRequests.length, pendingReturns.length, myRequests, myCustody, myReturns]);

  const actionItems = useMemo<FocusItem[]>(() => {
    if (role === 'manager') {
      return [
        { title: 'أصناف منخفضة المخزون', count: lowStockItems.length, hint: 'تحتاج متابعة وتوريد أو إعادة توزيع', href: '/inventory?status=LOW_STOCK', tone: lowStockItems.length ? 'warning' : 'good' },
        { title: 'أصناف نافدة', count: outOfStockItems.length, hint: 'تعطل مباشر محتمل على التشغيل', href: '/inventory?status=OUT_OF_STOCK', tone: outOfStockItems.length ? 'critical' : 'good' },
        { title: 'طلبات صرف متأخرة', count: pendingRequests.length, hint: 'طلبات لم تُصرف بعد', href: '/requests', tone: pendingRequests.length ? 'warning' : 'good' },
        { title: 'إرجاعات معلقة', count: pendingReturns.length, hint: 'تحتاج استلامًا من المخزن', href: '/returns', tone: pendingReturns.length ? 'warning' : 'good' },
        { title: 'عهد متأخرة', count: overdueCustody.length, hint: 'مواد تجاوزت الموعد المحدد', href: '/custody', tone: overdueCustody.length ? 'critical' : 'good' },
      ];
    }
    if (role === 'warehouse') {
      return [
        { title: 'طلبات تنتظر الصرف', count: pendingRequests.length, hint: 'نفّذها أولًا', href: '/requests', tone: pendingRequests.length ? 'primary' : 'good' },
        { title: 'إرجاعات تنتظر الاستلام', count: pendingReturns.length, hint: 'أغلقها بعد الفحص', href: '/returns', tone: pendingReturns.length ? 'warning' : 'good' },
        { title: 'أصناف منخفضة', count: lowStockItems.length, hint: 'تحتاج متابعة المخزون', href: '/inventory?status=LOW_STOCK', tone: lowStockItems.length ? 'warning' : 'good' },
        { title: 'أصناف نافدة', count: outOfStockItems.length, hint: 'تحتاج تدخلًا عاجلًا', href: '/inventory?status=OUT_OF_STOCK', tone: outOfStockItems.length ? 'critical' : 'good' },
      ];
    }
    return [
      { title: 'طلباتي الجديدة', count: myRequests.filter((item) => item.status === 'PENDING').length, hint: 'بانتظار الصرف', href: '/requests', tone: 'primary' },
      { title: 'عهدتي الحالية', count: myCustody.filter((item) => item.status !== 'RETURNED').length, hint: 'مواد في عهدتك', href: '/custody', tone: 'info' },
      { title: 'إرجاعات مفتوحة', count: myReturns.filter((item) => item.status === 'PENDING').length, hint: 'بانتظار استلام المخزن', href: '/returns', tone: 'warning' },
      { title: 'رسائل غير مقروءة', count: unreadNotifications.filter((item) => String(item.entityType || '').toLowerCase() === 'message').length, hint: 'راجع المراسلات', href: '/notifications', tone: 'info' },
    ];
  }, [role, lowStockItems.length, outOfStockItems.length, pendingRequests.length, pendingReturns.length, overdueCustody.length, myRequests, myCustody, myReturns, unreadNotifications]);

  const quickLinks = useMemo<QuickLink[]>(() => {
    const shared: QuickLink[] = [
      { label: 'الطلبات', href: '/requests', note: 'مراجعة الطلبات الحالية' },
      { label: 'الإرجاعات', href: '/returns', note: 'متابعة المرتجعات' },
      { label: 'المخزون', href: '/inventory', note: 'فتح قائمة المواد' },
      { label: 'الإشعارات', href: '/notifications', note: 'أحدث المستجدات' },
    ];
    if (role === 'manager') {
      return [
        { label: 'المستخدمون', href: '/users', note: 'إدارة الصلاحيات والحسابات' },
        { label: 'الصيانة', href: '/maintenance', note: 'طلبات الصيانة المفتوحة' },
        { label: 'الشراء المباشر', href: '/purchases', note: 'طلبات تحتاج قرارًا' },
        { label: 'الطلبات الأخرى', href: '/suggestions', note: 'نظافة وطلبات متنوعة' },
        ...shared,
      ];
    }
    if (role === 'warehouse') {
      return [
        { label: 'المخزون', href: '/inventory', note: 'الجرد والكمية الحالية' },
        { label: 'الطلبات', href: '/requests', note: 'طلبات بانتظار الصرف' },
        { label: 'الإرجاعات', href: '/returns', note: 'استلام المرتجعات' },
        { label: 'الصيانة', href: '/maintenance', note: 'طلبات تؤثر على الجاهزية' },
        ...shared.filter((item, index) => index > 2),
      ];
    }
    return [
      { label: 'طلب مواد', href: '/requests', note: 'إنشاء ومتابعة الطلبات' },
      { label: 'عهدتي', href: '/custody', note: 'مراجعة المواد المصروفة' },
      { label: 'الإرجاعات', href: '/returns', note: 'رفع طلب إرجاع' },
      { label: 'الصيانة', href: '/maintenance', note: 'فتح طلب صيانة' },
      { label: 'الشراء المباشر', href: '/purchases', note: 'طلب شراء مباشر' },
      { label: 'الطلبات الأخرى', href: '/suggestions', note: 'نظافة وطلبات متنوعة' },
      { label: 'الإشعارات', href: '/notifications', note: 'المستجدات' },
    ];
  }, [role]);

  const chartRows = useMemo(() => {
    if (role === 'manager') {
      return [
        { label: 'منخفض المخزون', value: lowStockItems.length, color: 'bg-[#d0b284]' },
        { label: 'نافد المخزون', value: outOfStockItems.length, color: 'bg-[#7c1e3e]' },
        { label: 'طلبات معلقة', value: pendingRequests.length, color: 'bg-[#016564]' },
        { label: 'إرجاعات معلقة', value: pendingReturns.length, color: 'bg-slate-500' },
      ];
    }
    if (role === 'warehouse') {
      return [
        { label: 'طلبات صرف', value: pendingRequests.length, color: 'bg-[#016564]' },
        { label: 'إرجاعات', value: pendingReturns.length, color: 'bg-[#d0b284]' },
        { label: 'منخفض المخزون', value: lowStockItems.length, color: 'bg-[#7c1e3e]' },
        { label: 'نافد المخزون', value: outOfStockItems.length, color: 'bg-slate-500' },
      ];
    }
    return [
      { label: 'طلباتي الجديدة', value: myRequests.filter((item) => item.status === 'PENDING').length, color: 'bg-[#016564]' },
      { label: 'عهدتي النشطة', value: myCustody.filter((item) => item.status !== 'RETURNED').length, color: 'bg-[#d0b284]' },
      { label: 'إرجاعاتي المفتوحة', value: myReturns.filter((item) => item.status === 'PENDING').length, color: 'bg-[#7c1e3e]' },
      { label: 'رسائل غير مقروءة', value: unreadNotifications.filter((item) => String(item.entityType || '').toLowerCase() === 'message').length, color: 'bg-slate-500' },
    ];
  }, [role, lowStockItems.length, outOfStockItems.length, pendingRequests.length, pendingReturns.length, myRequests, myCustody, myReturns, unreadNotifications]);

  const maxChart = Math.max(1, ...chartRows.map((item) => item.value || 0));

  const latestFeed = useMemo(() => notifications.slice(0, 6), [notifications]);

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6 lg:p-7">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(1,101,100,0.10),transparent_35%),radial-gradient(circle_at_bottom_left,rgba(208,178,132,0.13),transparent_30%)]" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex items-center rounded-full border border-[#016564]/15 bg-[#016564]/[0.05] px-3 py-1 text-xs font-semibold text-[#016564]">
              {role === 'manager' ? 'لوحة المدير التنفيذية' : role === 'warehouse' ? 'لوحة مسؤول المخزن' : 'لوحة الموظف'}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              مؤشرات تشغيلية حقيقية، وإجراءات سريعة، ووصول مباشر
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
              تركيز مباشر على المخزون، والطلبات، والإرجاعات، والعهدة، والصيانة، والشراء المباشر، والطلبات الأخرى دون ازدحام.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3">
            <Card className="rounded-[24px] border border-[#016564]/10 bg-white/90 p-4">
              <div className="text-xs text-slate-500">إشعارات غير مقروءة</div>
              <div className="mt-2 text-3xl font-bold text-[#016564]">{unreadNotifications.length}</div>
            </Card>
            <Card className="rounded-[24px] border border-[#d0b284]/20 bg-white/90 p-4">
              <div className="text-xs text-slate-500">العناصر المفتوحة</div>
              <div className="mt-2 text-3xl font-bold text-slate-900">{pendingRequests.length + pendingReturns.length + openMaintenance.length + openPurchases.length + openSuggestions.length}</div>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((item) => (
          <Card key={item.title} className="relative overflow-hidden rounded-[26px] border border-slate-200 bg-white p-5 shadow-soft">
            <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.accent}`} />
            <div className="text-sm font-medium text-slate-500">{item.title}</div>
            <div className="mt-3 text-3xl font-bold tracking-tight text-slate-900">{item.value}</div>
            <div className="mt-2 text-xs leading-6 text-slate-500">{item.note}</div>
          </Card>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Card className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-900">الإجراءات التي تحتاج انتباهك الآن</h2>
              <p className="mt-1 text-sm text-slate-500">بطاقات تنفيذية مباشرة مبنية على البيانات الحالية داخل النظام.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {actionItems.map((item) => (
              <Link key={item.title} href={item.href}>
                <div className={`rounded-[24px] border p-4 transition hover:-translate-y-0.5 ${toneClasses(item.tone)}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold">{item.title}</div>
                    <div className="rounded-full bg-white/70 px-3 py-1 text-sm font-bold">{item.count}</div>
                  </div>
                  <div className="mt-2 text-xs leading-6 opacity-80">{item.hint}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">رسم تشغيلي سريع</h2>
          <p className="mt-1 text-sm text-slate-500">يوضح أبرز محاور الضغط الحالية دون ازدحام.</p>
          <div className="mt-5 space-y-4">
            {chartRows.map((row) => (
              <div key={row.label}>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{row.label}</span>
                  <span className="font-bold text-slate-900">{row.value}</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <div className={`${row.color} h-full rounded-full`} style={{ width: `${Math.max(8, (row.value / maxChart) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Card className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">وصول سريع</h2>
          <p className="mt-1 text-sm text-slate-500">اختصارات مباشرة للصفحات الأكثر استخدامًا في يوم العمل.</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickLinks.map((item) => (
              <Link key={item.label} href={item.href}>
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 transition hover:border-[#016564]/20 hover:bg-white hover:shadow-soft">
                  <div className="text-sm font-bold text-slate-900">{item.label}</div>
                  <div className="mt-1 text-xs leading-6 text-slate-500">{item.note}</div>
                </div>
              </Link>
            ))}
          </div>
        </Card>

        <Card className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-soft sm:p-6">
          <h2 className="text-lg font-bold text-slate-900">آخر المستجدات</h2>
          <p className="mt-1 text-sm text-slate-500">آخر الأحداث التشغيلية والإشعارات الواردة من النظام.</p>
          <div className="mt-5 space-y-3">
            {loading ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">جارٍ تحميل البيانات...</div>
            ) : latestFeed.length === 0 ? (
              <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">لا توجد مستجدات حديثة الآن.</div>
            ) : latestFeed.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-sm font-bold text-slate-900">{item.title}</div>
                  <div className="text-[11px] text-slate-400">{formatRelative(item.createdAt)}</div>
                </div>
                <div className="mt-1 text-xs leading-6 text-slate-600">{item.message}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}
