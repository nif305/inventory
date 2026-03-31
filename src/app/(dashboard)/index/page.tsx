'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

type GenericItem = Record<string, any>;

type DashboardData = {
  inventory: GenericItem[];
  requests: GenericItem[];
  returns: GenericItem[];
  custody: GenericItem[];
  maintenance: GenericItem[];
  purchases: GenericItem[];
  suggestions: GenericItem[];
  notifications: GenericItem[];
};

const EMPTY_DATA: DashboardData = {
  inventory: [],
  requests: [],
  returns: [],
  custody: [],
  maintenance: [],
  purchases: [],
  suggestions: [],
  notifications: [],
};

function getArrayPayload(payload: any): GenericItem[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.rows)) return payload.rows;
  return [];
}

function normalizeRole(role?: string | null) {
  const value = String(role || '').toLowerCase();
  if (value === 'manager') return 'manager';
  if (value === 'warehouse') return 'warehouse';
  return 'user';
}

function isOpenStatus(value: any) {
  const s = String(value || '').toUpperCase();
  return ['PENDING', 'OPEN', 'NEW', 'IN_PROGRESS', 'ACTIVE', 'RETURN_REQUESTED'].includes(s);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('ar-SA').format(value || 0);
}

function getRequestItemsCount(requests: GenericItem[]) {
  return requests.reduce((sum, req) => sum + (Array.isArray(req?.items) ? req.items.length : 0), 0);
}

function cardToneClasses(tone: 'primary' | 'gold' | 'danger' | 'neutral' | 'success') {
  if (tone === 'primary') return 'from-[#016564] to-[#1b7f79] text-white border-[#016564]/20';
  if (tone === 'gold') return 'from-[#d0b284] to-[#e4cda9] text-slate-900 border-[#d0b284]/40';
  if (tone === 'danger') return 'from-[#7c1e3e] to-[#a12c54] text-white border-[#7c1e3e]/20';
  if (tone === 'success') return 'from-[#2d8f6f] to-[#4ea987] text-white border-[#2d8f6f]/20';
  return 'from-white to-[#f8f9f9] text-slate-900 border-slate-200';
}

function StatCard({
  title,
  value,
  subtitle,
  tone = 'neutral',
}: {
  title: string;
  value: number | string;
  subtitle: string;
  tone?: 'primary' | 'gold' | 'danger' | 'neutral' | 'success';
}) {
  return (
    <div
      className={`rounded-[28px] border bg-gradient-to-br p-5 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] ${cardToneClasses(tone)}`}
    >
      <div className="text-[13px] font-medium opacity-90">{title}</div>
      <div className="mt-3 text-[34px] font-bold leading-none">{value}</div>
      <div className="mt-3 text-[12px] leading-6 opacity-80">{subtitle}</div>
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white/95 p-5 shadow-[0_20px_60px_-32px_rgba(2,32,71,0.20)] backdrop-blur">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-[20px] font-bold text-[#016564]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[13px] leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ActionRow({
  title,
  count,
  hint,
  href,
  critical = false,
}: {
  title: string;
  count: number;
  hint: string;
  href: string;
  critical?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex items-center justify-between rounded-[22px] border px-4 py-4 transition hover:-translate-y-0.5 hover:shadow-md ${
        critical ? 'border-[#7c1e3e]/20 bg-[#fff7fa]' : 'border-slate-200 bg-slate-50 hover:bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="text-[15px] font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[12px] leading-6 text-slate-500">{hint}</div>
      </div>
      <div
        className={`rounded-full px-3 py-2 text-[13px] font-bold ${
          critical ? 'bg-[#7c1e3e] text-white' : 'bg-[#016564] text-white'
        }`}
      >
        {formatNumber(count)}
      </div>
    </Link>
  );
}

function QuickLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[20px] border border-slate-200 bg-white px-4 py-3 text-[14px] font-semibold text-slate-700 shadow-sm transition hover:border-[#016564]/30 hover:bg-[#f8fbfb] hover:text-[#016564]"
    >
      {label}
    </Link>
  );
}

function MiniBarChart({
  title,
  subtitle,
  data,
  colorClass = 'bg-[#016564]',
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  colorClass?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="space-y-4">
        {data.map((item) => (
          <div key={item.name}>
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="text-[13px] font-medium text-slate-700">{item.name}</div>
              <div className="text-[13px] font-bold text-slate-900">{formatNumber(item.value)}</div>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function DonutLegend({
  title,
  subtitle,
  data,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number; color: string }[];
}) {
  const total = data.reduce((sum, item) => sum + item.value, 0) || 1;

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="grid gap-4 xl:grid-cols-[180px_1fr] xl:items-center">
        <div className="relative mx-auto h-40 w-40">
          <div
            className="h-40 w-40 rounded-full"
            style={{
              background: `conic-gradient(${data
                .map((item) => `${item.color} ${(item.value / total) * 100}%`)
                .join(', ')})`,
            }}
          />
          <div className="absolute inset-5 flex items-center justify-center rounded-full bg-white text-center shadow-inner">
            <div>
              <div className="text-[11px] text-slate-500">الإجمالي</div>
              <div className="text-[24px] font-bold text-slate-900">{formatNumber(total)}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3 rounded-[18px] border border-slate-100 bg-slate-50 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="text-[14px] font-medium text-slate-700">{item.name}</span>
              </div>
              <div className="text-[14px] font-bold text-slate-900">{formatNumber(item.value)}</div>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}

function UnifiedDashboard() {
  const { user } = useAuth();
  const role = normalizeRole(user?.role);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const fetchJson = async (url: string) => {
      try {
        const res = await fetch(url, { credentials: 'include', cache: 'no-store' });
        const json = await res.json().catch(() => ({}));
        return getArrayPayload(json);
      } catch {
        return [];
      }
    };

    const load = async () => {
      setLoading(true);
      const [inventory, requests, returns, custody, maintenance, purchases, suggestions, notifications] =
        await Promise.all([
          fetchJson('/api/inventory'),
          fetchJson('/api/requests'),
          fetchJson('/api/returns'),
          fetchJson('/api/custody'),
          fetchJson('/api/maintenance'),
          fetchJson('/api/purchases'),
          fetchJson('/api/suggestions'),
          fetchJson('/api/notifications'),
        ]);

      if (!mounted) return;

      setData({
        inventory,
        requests,
        returns,
        custody,
        maintenance,
        purchases,
        suggestions,
        notifications,
      });
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const inventory = data.inventory;
    const requests = data.requests;
    const returns = data.returns;
    const custody = data.custody;
    const maintenance = data.maintenance;
    const purchases = data.purchases;
    const suggestions = data.suggestions;
    const notifications = data.notifications;

    const lowStock = inventory.filter((item) => {
      const qty = Number(item.availableQty ?? item.availableQuantity ?? item.qty ?? 0);
      return qty > 0 && qty <= 5;
    }).length;

    const outOfStock = inventory.filter((item) => {
      const qty = Number(item.availableQty ?? item.availableQuantity ?? item.qty ?? 0);
      return qty <= 0;
    }).length;

    const returnableItems = inventory.filter(
      (item) => String(item.type || '').toUpperCase() === 'RETURNABLE'
    ).length;
    const consumableItems = inventory.filter(
      (item) => String(item.type || '').toUpperCase() === 'CONSUMABLE'
    ).length;

    const pendingRequests = requests.filter(
      (item) => String(item.status || '').toUpperCase() === 'PENDING'
    ).length;
    const issuedRequests = requests.filter(
      (item) => String(item.status || '').toUpperCase() === 'ISSUED'
    ).length;
    const rejectedRequests = requests.filter(
      (item) => String(item.status || '').toUpperCase() === 'REJECTED'
    ).length;

    const pendingReturns = returns.filter(
      (item) => String(item.status || '').toUpperCase() === 'PENDING'
    ).length;
    const approvedReturns = returns.filter(
      (item) => String(item.status || '').toUpperCase() === 'APPROVED'
    ).length;

    const activeCustody = custody.filter(
      (item) => String(item.status || '').toUpperCase() === 'ACTIVE'
    ).length;
    const delayedCustody = custody.filter((item) => {
      const due = item.expectedReturn || item.dueDate;
      if (!due) return false;
      return new Date(due).getTime() < Date.now() && String(item.status || '').toUpperCase() !== 'RETURNED';
    }).length;

    const openMaintenance = maintenance.filter((item) => isOpenStatus(item.status)).length;
    const openPurchases = purchases.filter((item) => isOpenStatus(item.status)).length;
    const cleaningRequests = suggestions.filter(
      (item) => String(item.category || '').toUpperCase() === 'CLEANING' && isOpenStatus(item.status)
    ).length;
    const otherRequests = suggestions.filter(
      (item) => String(item.category || '').toUpperCase() !== 'CLEANING' && isOpenStatus(item.status)
    ).length;

    const unreadNotifications = notifications.filter((item) => !item.isRead).length;

    return {
      totalInventory: inventory.length,
      lowStock,
      outOfStock,
      returnableItems,
      consumableItems,
      pendingRequests,
      issuedRequests,
      rejectedRequests,
      pendingReturns,
      approvedReturns,
      activeCustody,
      delayedCustody,
      openMaintenance,
      openPurchases,
      cleaningRequests,
      otherRequests,
      unreadNotifications,
      requestItemsCount: getRequestItemsCount(requests),
    };
  }, [data]);

  const inventoryChartData = useMemo(
    () => [
      { name: 'متاح', value: Math.max(metrics.totalInventory - metrics.lowStock - metrics.outOfStock, 0), color: '#016564' },
      { name: 'منخفض', value: metrics.lowStock, color: '#d0b284' },
      { name: 'نافد', value: metrics.outOfStock, color: '#7c1e3e' },
    ],
    [metrics]
  );

  const requestFlowData = useMemo(
    () => [
      { name: 'جديد', value: metrics.pendingRequests },
      { name: 'تم الصرف', value: metrics.issuedRequests },
      { name: 'مرفوض', value: metrics.rejectedRequests },
      { name: 'إرجاع مفتوح', value: metrics.pendingReturns },
    ],
    [metrics]
  );

  const serviceDemandData = useMemo(
    () => [
      { name: 'صيانة', value: metrics.openMaintenance },
      { name: 'شراء مباشر', value: metrics.openPurchases },
      { name: 'نظافة', value: metrics.cleaningRequests },
      { name: 'طلبات أخرى', value: metrics.otherRequests },
    ],
    [metrics]
  );

  const quickLinks = useMemo(() => {
    if (role === 'manager') {
      return [
        { href: '/inventory', label: 'فتح المخزون' },
        { href: '/requests', label: 'فتح الطلبات' },
        { href: '/returns', label: 'فتح الإرجاعات' },
        { href: '/users', label: 'إدارة المستخدمين' },
        { href: '/reports', label: 'التقارير' },
        { href: '/notifications', label: 'الإشعارات' },
      ];
    }
    if (role === 'warehouse') {
      return [
        { href: '/inventory', label: 'تجهيز المواد' },
        { href: '/requests', label: 'صرف الطلبات' },
        { href: '/returns', label: 'استلام الإرجاعات' },
        { href: '/maintenance', label: 'طلبات الصيانة' },
        { href: '/notifications', label: 'الإشعارات' },
      ];
    }
    return [
      { href: '/requests', label: 'طلب مواد' },
      { href: '/custody', label: 'عهدتي' },
      { href: '/returns', label: 'طلبات الإرجاع' },
      { href: '/maintenance', label: 'طلبات الصيانة' },
      { href: '/notifications', label: 'الإشعارات' },
    ];
  }, [role]);

  const actionRows = useMemo(() => {
    if (role === 'manager') {
      return [
        {
          title: 'طلبات صرف بانتظار التنفيذ',
          count: metrics.pendingRequests,
          hint: 'طلبات مواد تحتاج تدخلًا تشغيليًا',
          href: '/requests',
          critical: metrics.pendingRequests > 0,
        },
        {
          title: 'إرجاعات بانتظار الاستلام',
          count: metrics.pendingReturns,
          hint: 'مواد عائدة لم تُستلم بعد',
          href: '/returns',
          critical: metrics.pendingReturns > 0,
        },
        {
          title: 'عهد متأخرة',
          count: metrics.delayedCustody,
          hint: 'مواد تجاوزت تاريخ الإرجاع',
          href: '/custody',
          critical: metrics.delayedCustody > 0,
        },
        {
          title: 'مواد منخفضة أو نافدة',
          count: metrics.lowStock + metrics.outOfStock,
          hint: 'تحتاج قرارًا على المخزون أو التوريد',
          href: '/inventory',
          critical: metrics.outOfStock > 0,
        },
        {
          title: 'طلبات خدمية مفتوحة',
          count: metrics.openMaintenance + metrics.openPurchases + metrics.cleaningRequests + metrics.otherRequests,
          hint: 'صيانة وشراء ونظافة وطلبات أخرى',
          href: '/maintenance',
          critical: false,
        },
      ];
    }

    if (role === 'warehouse') {
      return [
        {
          title: 'طلبات بانتظار الصرف',
          count: metrics.pendingRequests,
          hint: 'نفّذ الصرف للطلبات الجديدة',
          href: '/requests',
          critical: metrics.pendingRequests > 0,
        },
        {
          title: 'إرجاعات تنتظر الاستلام',
          count: metrics.pendingReturns,
          hint: 'أغلق عمليات الاستلام والتوثيق',
          href: '/returns',
          critical: metrics.pendingReturns > 0,
        },
        {
          title: 'مواد منخفضة الكمية',
          count: metrics.lowStock,
          hint: 'تابع الأصناف القريبة من حد الأمان',
          href: '/inventory',
          critical: metrics.lowStock > 0,
        },
        {
          title: 'مواد نافدة الكمية',
          count: metrics.outOfStock,
          hint: 'هذه الأصناف ستعطل الطلبات الجديدة',
          href: '/inventory',
          critical: metrics.outOfStock > 0,
        },
        {
          title: 'عهد تحتاج متابعة',
          count: metrics.activeCustody + metrics.delayedCustody,
          hint: 'مواد مصروفة تحتاج إرجاعًا أو متابعة',
          href: '/custody',
          critical: metrics.delayedCustody > 0,
        },
      ];
    }

    return [
      {
        title: 'طلباتي الجديدة',
        count: metrics.pendingRequests,
        hint: 'طلبات مواد ما زالت قيد الانتظار',
        href: '/requests',
        critical: false,
      },
      {
        title: 'طلباتي المصروفة',
        count: metrics.issuedRequests,
        hint: 'طلبات تم صرفها لك بالفعل',
        href: '/requests',
        critical: false,
      },
      {
        title: 'عهدتي النشطة',
        count: metrics.activeCustody,
        hint: 'مواد مسترجعة مسجلة عليك',
        href: '/custody',
        critical: false,
      },
      {
        title: 'عهد تحتاج إرجاعًا',
        count: metrics.delayedCustody,
        hint: 'عهد تجاوزت الموعد المحدد',
        href: '/custody',
        critical: metrics.delayedCustody > 0,
      },
      {
        title: 'إرجاعاتي المفتوحة',
        count: metrics.pendingReturns,
        hint: 'طلبات إرجاع لم تُستلم بعد',
        href: '/returns',
        critical: false,
      },
    ];
  }, [metrics, role]);

  const latestUpdates = useMemo(() => {
    return (data.notifications || [])
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);
  }, [data.notifications]);

  const heroTitle =
    role === 'manager'
      ? 'لوحة قيادة تشغيلية للمخزون والطلبات'
      : role === 'warehouse'
      ? 'لوحة تنفيذ يومية لمسؤول المخزن'
      : 'لوحة متابعة شخصية للطلبات والعهدة';

  const heroText =
    role === 'manager'
      ? 'تعرض الاختناقات التشغيلية، حالة المخزون، الطلبات المفتوحة، ونقاط التدخل الإداري المباشر.'
      : role === 'warehouse'
      ? 'تعرض ما يجب صرفه واستلامه ومتابعته الآن، مع مؤشرات المخزون الحرجة والمواد تحت الضغط.'
      : 'تعرض طلباتك وعهدتك وإرجاعاتك وتحديثاتك الأحدث بشكل مباشر وواضح.';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[34px] border border-[#016564]/10 bg-[radial-gradient(circle_at_top_right,rgba(208,178,132,0.28),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(1,101,100,0.22),transparent_28%),linear-gradient(135deg,#ffffff_0%,#f7fbfb_42%,#eef7f6_100%)] p-6 shadow-[0_26px_80px_-35px_rgba(1,101,100,0.35)] sm:p-8">
        <div className="absolute -left-8 -top-8 h-28 w-28 rounded-full bg-[#016564]/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-36 w-36 rounded-full bg-[#d0b284]/20 blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
          <div>
            <div className="inline-flex rounded-full border border-[#016564]/15 bg-white/80 px-4 py-2 text-[12px] font-semibold text-[#016564] shadow-sm">
              مركز قيادة المواد التدريبية
            </div>
            <h1 className="mt-4 max-w-3xl text-[28px] font-bold leading-[1.3] text-slate-900 sm:text-[38px]">
              {heroTitle}
            </h1>
            <p className="mt-3 max-w-2xl text-[14px] leading-8 text-slate-600 sm:text-[15px]">
              {heroText}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard title="إجمالي الأصناف" value={formatNumber(metrics.totalInventory)} subtitle="عدد المواد المعرفة في النظام" tone="primary" />
              <StatCard title="طلبات بانتظار الإجراء" value={formatNumber(metrics.pendingRequests + metrics.pendingReturns)} subtitle="صرف أو استلام" tone="danger" />
              <StatCard title="تنبيهات غير مقروءة" value={formatNumber(metrics.unreadNotifications)} subtitle="آخر ما وصلك داخل النظام" tone="gold" />
            </div>
          </div>

          <div className="grid gap-3">
            <DonutLegend title="مؤشر المخزون" subtitle="قراءة سريعة لحالة الأصناف" data={inventoryChartData} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard title="مواد منخفضة" value={formatNumber(metrics.lowStock)} subtitle="تحتاج متابعة قريبة" tone="gold" />
        <StatCard title="مواد نافدة" value={formatNumber(metrics.outOfStock)} subtitle="تؤثر على الجاهزية" tone="danger" />
        <StatCard title="مواد قابلة للإرجاع" value={formatNumber(metrics.returnableItems)} subtitle="مرتبطة بالعهدة" tone="success" />
        <StatCard title="مواد استهلاكية" value={formatNumber(metrics.consumableItems)} subtitle="صرف مباشر واستهلاك" tone="neutral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard
          title={
            role === 'manager'
              ? 'أهم العناصر التي تستدعي تدخلًا مباشرًا'
              : role === 'warehouse'
              ? 'الإجراءات التشغيلية الحالية'
              : 'ما الذي يجب متابعته الآن؟'
          }
          subtitle="عناصر تنفيذية مباشرة وليست معلومات عامة"
        >
          <div className="space-y-3">
            {actionRows.map((row) => (
              <ActionRow key={row.title} {...row} />
            ))}
          </div>
        </SectionCard>

        <SectionCard title="وصول سريع" subtitle="اختصارات مباشرة إلى أهم المسارات">
          <div className="grid gap-3 sm:grid-cols-2">
            {quickLinks.map((link) => (
              <QuickLink key={link.href} href={link.href} label={link.label} />
            ))}
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[13px] font-semibold text-[#016564]">العهدة النشطة</div>
              <div className="mt-2 text-[26px] font-bold text-slate-900">{formatNumber(metrics.activeCustody)}</div>
              <div className="mt-1 text-[12px] text-slate-500">عدد المواد المسجلة في العهدة حاليًا</div>
            </div>
            <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="text-[13px] font-semibold text-[#016564]">بنود الطلبات</div>
              <div className="mt-2 text-[26px] font-bold text-slate-900">{formatNumber(metrics.requestItemsCount)}</div>
              <div className="mt-1 text-[12px] text-slate-500">إجمالي البنود المسجلة في الطلبات</div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <MiniBarChart title="حركة الطلبات والإرجاعات" subtitle="رسم مباشر يفيد القرار اليومي" data={requestFlowData} colorClass="bg-[#016564]" />
        <MiniBarChart title="الخدمات التشغيلية المساندة" subtitle="صيانة وشراء ونظافة وطلبات أخرى" data={serviceDemandData} colorClass="bg-[#7c1e3e]" />
      </div>

      <SectionCard
        title="آخر ما وصلك"
        subtitle="أحدث الإشعارات والأنشطة المسجلة في النظام"
        action={
          <Link href="/notifications" className="text-[13px] font-semibold text-[#016564]">
            فتح صفحة الإشعارات
          </Link>
        }
      >
        {loading ? (
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
            جارٍ تحميل البيانات...
          </div>
        ) : latestUpdates.length === 0 ? (
          <div className="rounded-[22px] border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
            لا توجد تحديثات حديثة
          </div>
        ) : (
          <div className="grid gap-3 xl:grid-cols-2">
            {latestUpdates.map((item) => (
              <div key={item.id} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-[15px] font-bold text-slate-900">{item.title || 'إشعار'}</div>
                <div className="mt-1 text-[13px] leading-7 text-slate-600">{item.message || 'لا توجد تفاصيل إضافية'}</div>
                <div className="mt-3 text-[11px] text-slate-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : '—'}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

export default function DashboardPage() {
  return <UnifiedDashboard />;
}
