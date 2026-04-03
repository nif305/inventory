'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

type GenericItem = Record<string, any>;
type ApiPayload = Record<string, any> | GenericItem[] | null;

type DashboardData = {
  inventoryRaw: ApiPayload;
  requestsRaw: ApiPayload;
  returnsRaw: ApiPayload;
  custodyRaw: ApiPayload;
  maintenanceRaw: ApiPayload;
  purchasesRaw: ApiPayload;
  suggestionsRaw: ApiPayload;
  notificationsRaw: ApiPayload;
};

const EMPTY_DATA: DashboardData = {
  inventoryRaw: null,
  requestsRaw: null,
  returnsRaw: null,
  custodyRaw: null,
  maintenanceRaw: null,
  purchasesRaw: null,
  suggestionsRaw: null,
  notificationsRaw: null,
};

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

function toNumber(value: any): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const cleaned = value.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getArrayPayload(payload: ApiPayload): GenericItem[] {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray((payload as any)?.data)) return (payload as any).data;
  if (Array.isArray((payload as any)?.items)) return (payload as any).items;
  if (Array.isArray((payload as any)?.rows)) return (payload as any).rows;
  if (Array.isArray((payload as any)?.results)) return (payload as any).results;
  return [];
}

function getAtPath(obj: any, path: string): any {
  if (!obj) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function pickStat(payload: ApiPayload, paths: string[], fallback: number): number {
  for (const path of paths) {
    const value = toNumber(getAtPath(payload, path));
    if (value != null) return value;
  }
  return fallback;
}

function countRequestItems(requests: GenericItem[]) {
  return requests.reduce((sum, req) => sum + (Array.isArray(req?.items) ? req.items.length : 0), 0);
}

function SurfaceCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[22px] border border-slate-200 bg-white shadow-[0_18px_50px_-36px_rgba(15,23,42,0.28)] ${className}`}>
      {children}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <SurfaceCard className="p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-[#016564]">{title}</h2>
          {subtitle ? <p className="mt-1 text-[12px] leading-6 text-slate-500">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </SurfaceCard>
  );
}

function QuickAction({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-[16px] border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] font-semibold text-slate-700 transition hover:border-[#016564]/25 hover:bg-[#f7fbfb] hover:text-[#016564]"
    >
      {label}
    </Link>
  );
}

function ActionItem({
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
      className={`flex items-center justify-between gap-3 rounded-[18px] border px-4 py-3 transition hover:-translate-y-0.5 hover:shadow-sm ${
        critical ? 'border-[#7c1e3e]/15 bg-[#fff8fa]' : 'border-slate-200 bg-slate-50 hover:bg-white'
      }`}
    >
      <div className="min-w-0">
        <div className="text-[14px] font-semibold text-slate-900">{title}</div>
        <div className="mt-1 text-[11px] leading-5 text-slate-500">{hint}</div>
      </div>
      <div
        className={`rounded-full px-3 py-1.5 text-[12px] font-bold ${
          critical ? 'bg-[#7c1e3e] text-white' : 'bg-[#016564] text-white'
        }`}
      >
        {formatNumber(count)}
      </div>
    </Link>
  );
}

function StatCard({
  title,
  value,
  note,
  tone = 'default',
}: {
  title: string;
  value: number;
  note: string;
  tone?: 'default' | 'primary' | 'gold' | 'danger' | 'success';
}) {
  const tones: Record<string, string> = {
    default: 'bg-white text-slate-900',
    primary: 'bg-[#f4fbfa] text-[#016564]',
    gold: 'bg-[#fbf7ee] text-[#9b7a31]',
    danger: 'bg-[#fff7fa] text-[#7c1e3e]',
    success: 'bg-[#f2fbf7] text-[#21795c]',
  };

  return (
    <SurfaceCard className={`p-4 ${tones[tone]}`}>
      <div className="text-[12px] font-medium text-slate-500">{title}</div>
      <div className="mt-2 text-[26px] font-bold leading-none">{formatNumber(value)}</div>
      <div className="mt-2 text-[11px] leading-5 text-slate-500">{note}</div>
    </SurfaceCard>
  );
}


function ClickableStatCard({ href, ...props }: { href: string; title: string; value: number; note: string; tone?: 'default' | 'primary' | 'gold' | 'danger' | 'success'; }) {
  return <Link href={href} className="block transition hover:-translate-y-0.5"><StatCard {...props} /></Link>;
}

function InventoryDonut({
  total,
  data,
}: {
  total: number;
  data: { name: string; value: number; color: string }[];
}) {
  const safeTotal = total || 1;
  let start = 0;
  const segments = data
    .map((item) => {
      const angle = (item.value / safeTotal) * 360;
      const seg = `${item.color} ${start}deg ${start + angle}deg`;
      start += angle;
      return seg;
    })
    .join(', ');

  return (
    <div className="grid gap-4 xl:grid-cols-[132px_1fr] xl:items-center">
      <div className="relative mx-auto h-[132px] w-[132px]">
        <div className="h-[132px] w-[132px] rounded-full" style={{ background: `conic-gradient(${segments})` }} />
        <div className="absolute inset-[16px] flex items-center justify-center rounded-full bg-white shadow-inner">
          <div className="text-center">
            <div className="text-[10px] text-slate-400">الإجمالي</div>
            <div className="mt-1 text-[24px] font-bold text-slate-900">{formatNumber(total)}</div>
          </div>
        </div>
      </div>

      <div className="space-y-2.5">
        {data.map((item) => (
          <div key={item.name} className="flex items-center justify-between rounded-[16px] bg-slate-50 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-[13px] font-medium text-slate-700">{item.name}</span>
            </div>
            <span className="text-[13px] font-bold text-slate-900">{formatNumber(item.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniBarChart({
  title,
  subtitle,
  data,
  color,
}: {
  title: string;
  subtitle: string;
  data: { name: string; value: number }[];
  color: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <SectionCard title={title} subtitle={subtitle}>
      <div className="space-y-3">
        {data.map((item) => (
          <div key={item.name}>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="text-[12px] font-medium text-slate-700">{item.name}</div>
              <div className="text-[12px] font-bold text-slate-900">{formatNumber(item.value)}</div>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full"
                style={{
                  backgroundColor: color,
                  width: `${Math.max((item.value / max) * 100, item.value > 0 ? 8 : 0)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function Hero({
  badge,
  title,
  text,
  children,
}: {
  badge: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[28px] border border-[#016564]/10 bg-[radial-gradient(circle_at_top_right,rgba(208,178,132,0.18),transparent_30%),linear-gradient(135deg,#ffffff_0%,#f8fbfb_48%,#f1f8f7_100%)] p-5 sm:p-6">
      <div className="absolute inset-y-0 left-0 w-32 bg-[linear-gradient(180deg,rgba(1,101,100,0.06),transparent)] blur-2xl" />
      <div className="relative space-y-4">
        <div className="inline-flex rounded-full border border-[#016564]/15 bg-white/80 px-3 py-1.5 text-[11px] font-semibold text-[#016564]">
          {badge}
        </div>
        <div>
          <h1 className="text-[22px] font-bold leading-[1.4] text-slate-900 sm:text-[28px]">{title}</h1>
          <p className="mt-2 max-w-3xl text-[13px] leading-7 text-slate-600">{text}</p>
        </div>
        {children}
      </div>
    </section>
  );
}

function LatestUpdates({ items, loading }: { items: GenericItem[]; loading: boolean }) {
  return (
    <SectionCard
      title="آخر ما وصلك"
      subtitle="أحدث الإشعارات والتحديثات"
      action={<Link href="/notifications" className="text-[12px] font-semibold text-[#016564]">فتح الإشعارات</Link>}
    >
      {loading ? (
        <div className="rounded-[18px] bg-slate-50 p-5 text-center text-[13px] text-slate-500">جارٍ تحميل البيانات...</div>
      ) : items.length === 0 ? (
        <div className="rounded-[18px] bg-slate-50 p-5 text-center text-[13px] text-slate-500">لا توجد تحديثات حديثة</div>
      ) : (
        <div className="grid gap-3 xl:grid-cols-2">
          {items.map((item) => (
            <SurfaceCard key={item.id} className="p-4">
              <div className="text-[14px] font-bold text-slate-900">{item.title || 'إشعار'}</div>
              <div className="mt-1 text-[12px] leading-6 text-slate-600">{item.message || 'لا توجد تفاصيل إضافية'}</div>
              <div className="mt-2 text-[11px] text-slate-400">
                {item.createdAt ? new Date(item.createdAt).toLocaleString('ar-SA') : '—'}
              </div>
            </SurfaceCard>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

function ManagerDashboard(props: any) {
  const { metrics, inventoryStatusData, requestFlowData, servicesData, latestUpdates, loading } = props;
  const actions = [
    { title: 'طلبات صرف بانتظار التنفيذ', count: metrics.pendingRequests, hint: 'طلبات مواد تحتاج تدخلًا مباشرًا', href: '/requests', critical: metrics.pendingRequests > 0 },
    { title: 'طلبات صيانة بانتظار الاعتماد', count: metrics.maintenancePending, hint: 'طلبات خدمية تحتاج قرار المدير', href: '/suggestions?type=MAINTENANCE', critical: metrics.maintenancePending > 0 },
    { title: 'طلبات نظافة بانتظار الاعتماد', count: metrics.cleaningPending, hint: 'طلبات نظافة تحتاج قرار المدير', href: '/suggestions?type=CLEANING', critical: metrics.cleaningPending > 0 },
    { title: 'طلبات شراء مباشر بانتظار الاعتماد', count: metrics.purchasePending, hint: 'طلبات شراء تحتاج قرار المدير', href: '/suggestions?type=PURCHASE', critical: metrics.purchasePending > 0 },
    { title: 'طلبات أخرى بانتظار الاعتماد', count: metrics.otherPending, hint: 'طلبات أخرى تحتاج قرار المدير', href: '/suggestions?type=OTHER', critical: metrics.otherPending > 0 },
    { title: 'مواد منخفضة أو نافدة', count: metrics.lowStock + metrics.outOfStock, hint: 'تحتاج قرارًا على المخزون أو التوريد', href: '/inventory', critical: metrics.outOfStock > 0 },
  ];

  const links = [
    { href: '/inventory?status=LOW_STOCK', label: 'المواد المنخفضة' },
    { href: '/inventory?status=OUT_OF_STOCK', label: 'المواد النافدة' },
    { href: '/requests', label: 'فتح الطلبات' },
    { href: '/suggestions?type=MAINTENANCE', label: 'طلبات الصيانة' },
    { href: '/suggestions?type=CLEANING', label: 'طلبات النظافة' },
    { href: '/suggestions?type=PURCHASE', label: 'طلبات الشراء المباشر' },
    { href: '/suggestions?type=OTHER', label: 'الطلبات الأخرى' },
    { href: '/email-drafts', label: 'المراسلات الخارجية' },
  ];

  return (
    <div className="space-y-5">
      <Hero badge="لوحة المدير" title="لوحة قيادة تشغيلية للمخزون والطلبات" text="مخصصة للرقابة على حالة المخزون، الاختناقات التشغيلية، والطلبات التي تستدعي تدخلًا إداريًا مباشرًا.">
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="text-[14px] font-bold text-[#016564]">مؤشر المخزون</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">قراءة سريعة لحالة الأصناف</div>
            <div className="mt-4">
              <InventoryDonut total={metrics.totalInventory} data={inventoryStatusData} />
            </div>
          </SurfaceCard>

          <div className="grid gap-3 sm:grid-cols-3">
            <ClickableStatCard href="/inventory" title="إجمالي الأصناف" value={metrics.totalInventory} note="عدد المواد المعرفة في النظام" tone="primary" />
            <ClickableStatCard href="/requests" title="طلبات بانتظار الإجراء" value={metrics.pendingRequests + metrics.pendingReturns} note="صرف أو استلام" tone="danger" />
            <ClickableStatCard href="/notifications" title="تنبيهات غير مقروءة" value={metrics.unreadNotifications} note="آخر ما وصلك داخل النظام" tone="gold" />
            <ClickableStatCard href="/inventory?status=LOW_STOCK" title="مواد منخفضة" value={metrics.lowStock} note="تحتاج متابعة قريبة" tone="gold" />
            <ClickableStatCard href="/inventory?status=OUT_OF_STOCK" title="مواد نافدة" value={metrics.outOfStock} note="تؤثر على الجاهزية" tone="danger" />
            <ClickableStatCard href="/custody?filter=late" title="عهد متأخرة" value={metrics.delayedCustody} note="مواد تجاوزت الموعد المحدد" tone="default" />
            <ClickableStatCard href="/suggestions?type=MAINTENANCE" title="طلبات صيانة" value={metrics.maintenancePending} note="بانتظار اعتماد المدير" tone="danger" />
            <ClickableStatCard href="/suggestions?type=CLEANING" title="طلبات نظافة" value={metrics.cleaningPending} note="بانتظار اعتماد المدير" tone="primary" />
            <ClickableStatCard href="/suggestions?type=PURCHASE" title="طلبات شراء مباشر" value={metrics.purchasePending} note="بانتظار اعتماد المدير" tone="gold" />
          </div>
        </div>
      </Hero>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="أهم العناصر التي تستدعي تدخلًا مباشرًا" subtitle="عناصر تنفيذية مرتبطة بقرار المدير">
          <div className="space-y-2.5">
            {actions.map((row) => <ActionItem key={row.title} {...row} />)}
          </div>
        </SectionCard>

        <SectionCard title="وصول سريع" subtitle="اختصارات إلى أهم المسارات">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => <QuickAction key={link.href} href={link.href} label={link.label} />)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <ClickableStatCard href="/suggestions" title="الخدمات المفتوحة" value={metrics.maintenancePending + metrics.cleaningPending + metrics.purchasePending + metrics.otherPending} note="صيانة وشراء ونظافة وطلبات أخرى" tone="default" />
            <StatCard title="بنود الطلبات" value={metrics.requestItemsCount} note="إجمالي البنود المسجلة" tone="primary" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MiniBarChart title="حركة الطلبات والإرجاعات" subtitle="قراءة سريعة للحالة الحالية" data={requestFlowData} color="#016564" />
        <MiniBarChart title="الخدمات التشغيلية المساندة" subtitle="صيانة وشراء ونظافة وطلبات أخرى" data={servicesData} color="#7c1e3e" />
      </div>

      <LatestUpdates items={latestUpdates} loading={loading} />
    </div>
  );
}

function WarehouseDashboard(props: any) {
  const { metrics, inventoryStatusData, requestFlowData, latestUpdates, loading } = props;
  const actions = [
    { title: 'طلبات بانتظار الصرف', count: metrics.pendingRequests, hint: 'نفّذ الصرف للطلبات الجديدة', href: '/requests', critical: metrics.pendingRequests > 0 },
    { title: 'إرجاعات تنتظر الاستلام', count: metrics.pendingReturns, hint: 'أغلق عمليات الاستلام والتوثيق', href: '/returns', critical: metrics.pendingReturns > 0 },
    { title: 'مواد منخفضة الكمية', count: metrics.lowStock, hint: 'أصناف قريبة من حد الأمان', href: '/inventory', critical: metrics.lowStock > 0 },
    { title: 'مواد نافدة الكمية', count: metrics.outOfStock, hint: 'ستؤثر على الطلبات الجديدة', href: '/inventory', critical: metrics.outOfStock > 0 },
  ];

  const links = [
    { href: '/inventory', label: 'المخزون' },
    { href: '/requests', label: 'صرف الطلبات' },
    { href: '/returns', label: 'استلام الإرجاعات' },
    { href: '/custody', label: 'العهد' },
    { href: '/notifications', label: 'الإشعارات' },
    { href: '/maintenance', label: 'الصيانة' },
  ];

  return (
    <div className="space-y-5">
      <Hero badge="لوحة مسؤول المخزن" title="لوحة تنفيذ يومية لمسؤول المخزن" text="مخصصة للتنفيذ اليومي: ما يجب صرفه واستلامه ومتابعته الآن، مع حالة الأصناف الأكثر تأثيرًا على الجاهزية.">
        <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
          <SurfaceCard className="p-4 sm:p-5">
            <div className="text-[14px] font-bold text-[#016564]">مؤشر المخزون</div>
            <div className="mt-1 text-[11px] leading-5 text-slate-500">يعرض حالة الأصناف ذات الأثر المباشر</div>
            <div className="mt-4">
              <InventoryDonut total={metrics.totalInventory} data={inventoryStatusData} />
            </div>
          </SurfaceCard>

          <div className="grid gap-3 sm:grid-cols-3">
            <StatCard title="طلبات تنتظر الصرف" value={metrics.pendingRequests} note="أولوية التنفيذ الأولى" tone="danger" />
            <StatCard title="إرجاعات تنتظر الاستلام" value={metrics.pendingReturns} note="تحتاج توثيقًا واستلامًا" tone="gold" />
            <StatCard title="مواد نافدة" value={metrics.outOfStock} note="قد تعطل الطلبات الجديدة" tone="danger" />
            <StatCard title="مواد منخفضة" value={metrics.lowStock} note="أصناف قريبة من حد الأمان" tone="gold" />
            <StatCard title="العهدة النشطة" value={metrics.activeCustody} note="مواد ما زالت لدى المستخدمين" tone="primary" />
            <StatCard title="مواد قابلة للإرجاع" value={metrics.returnableItems} note="مرتبطة بالإرجاع والمتابعة" tone="success" />
          </div>
        </div>
      </Hero>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="الإجراءات التشغيلية الحالية" subtitle="هذا ما يحتاج عملك الآن">
          <div className="space-y-2.5">
            {actions.map((row) => <ActionItem key={row.title} {...row} />)}
          </div>
        </SectionCard>

        <SectionCard title="وصول سريع" subtitle="اختصارات لمسارات العمل اليومية">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => <QuickAction key={link.href} href={link.href} label={link.label} />)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatCard title="مواد استهلاكية" value={metrics.consumableItems} note="صرف مباشر واستهلاك" tone="default" />
            <StatCard title="بنود الطلبات" value={metrics.requestItemsCount} note="إجمالي البنود المطلوب تجهيزها" tone="primary" />
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <MiniBarChart title="حركة الطلبات" subtitle="طلب جديد، صرف، رفض، إرجاع" data={requestFlowData} color="#016564" />
        <MiniBarChart title="حالة المخزون" subtitle="متاح، منخفض، نافد" data={inventoryStatusData.map((i: any) => ({ name: i.name, value: i.value }))} color="#7c1e3e" />
      </div>

      <LatestUpdates items={latestUpdates} loading={loading} />
    </div>
  );
}

function UserDashboard(props: any) {
  const { metrics, latestUpdates, loading } = props;
  const actions = [
    { title: 'طلباتي الجديدة', count: metrics.pendingRequests, hint: 'طلبات مواد ما زالت قيد الانتظار', href: '/requests' },
    { title: 'طلباتي المصروفة', count: metrics.issuedRequests, hint: 'طلبات تم صرفها لك بالفعل', href: '/requests' },
    { title: 'عهدتي النشطة', count: metrics.activeCustody, hint: 'مواد مسجلة عليك حاليًا', href: '/custody' },
    { title: 'إرجاعاتي المفتوحة', count: metrics.pendingReturns, hint: 'طلبات إرجاع لم تُستلم بعد', href: '/returns' },
  ];

  const links = [
    { href: '/requests', label: 'طلب مواد' },
    { href: '/custody', label: 'عهدتي' },
    { href: '/returns', label: 'طلبات الإرجاع' },
    { href: '/suggestions?type=MAINTENANCE&new=1', label: 'طلب صيانة' },
    { href: '/suggestions?type=CLEANING&new=1', label: 'طلب نظافة' },
    { href: '/suggestions?type=PURCHASE&new=1', label: 'شراء مباشر' },
    { href: '/suggestions?type=OTHER&new=1', label: 'طلبات أخرى' },
    { href: '/notifications', label: 'الإشعارات' },
  ];

  return (
    <div className="space-y-5">
      <Hero badge="لوحة الموظف" title="لوحة متابعة الطلبات والعهدة" text="مخصصة لمتابعة طلباتك وعهدتك وإرجاعاتك وتحديثاتك الأحدث بشكل مباشر وواضح.">
        <div className="grid gap-3 sm:grid-cols-4">
          <StatCard title="طلباتي الجديدة" value={metrics.pendingRequests} note="ما زالت قيد الانتظار" tone="primary" />
          <StatCard title="طلبات مصروفة" value={metrics.issuedRequests} note="تم تنفيذها لك بالفعل" tone="success" />
          <StatCard title="عهدتي النشطة" value={metrics.activeCustody} note="مواد ما زالت مسجلة عليك" tone="gold" />
          <StatCard title="تنبيهات غير مقروءة" value={metrics.unreadNotifications} note="آخر ما وصلك داخل النظام" tone="danger" />
        </div>
      </Hero>

      <div className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <SectionCard title="ما الذي يجب متابعته الآن؟" subtitle="أهم ما يخص حسابك مباشرة">
          <div className="space-y-2.5">
            {actions.map((row) => <ActionItem key={row.title} {...row} />)}
          </div>
        </SectionCard>

        <SectionCard title="وصول سريع" subtitle="اختصارات إلى مساراتك الأكثر استخدامًا">
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
            {links.map((link) => <QuickAction key={link.href} href={link.href} label={link.label} />)}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <StatCard title="طلبات الإرجاع المفتوحة" value={metrics.pendingReturns} note="ما زالت بانتظار الاستلام" tone="gold" />
            <StatCard title="طلباتي المرفوضة" value={metrics.rejectedRequests} note="تحتاج مراجعة أو إعادة رفع" tone="default" />
          </div>
        </SectionCard>
      </div>

      <LatestUpdates items={latestUpdates} loading={loading} />
    </div>
  );
}

function DashboardSwitcher({
  role,
  metrics,
  inventoryStatusData,
  requestFlowData,
  servicesData,
  latestUpdates,
  loading,
}: {
  role: string;
  metrics: any;
  inventoryStatusData: { name: string; value: number; color: string }[];
  requestFlowData: { name: string; value: number }[];
  servicesData: { name: string; value: number }[];
  latestUpdates: GenericItem[];
  loading: boolean;
}) {
  if (role === 'manager') {
    return (
      <ManagerDashboard
        metrics={metrics}
        inventoryStatusData={inventoryStatusData}
        requestFlowData={requestFlowData}
        servicesData={servicesData}
        latestUpdates={latestUpdates}
        loading={loading}
      />
    );
  }

  if (role === 'warehouse') {
    return (
      <WarehouseDashboard
        metrics={metrics}
        inventoryStatusData={inventoryStatusData}
        requestFlowData={requestFlowData}
        latestUpdates={latestUpdates}
        loading={loading}
      />
    );
  }

  return <UserDashboard metrics={metrics} latestUpdates={latestUpdates} loading={loading} />;
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
        return await res.json().catch(() => ({}));
      } catch {
        return {};
      }
    };

    const load = async () => {
      setLoading(true);
      const [inventoryRaw, requestsRaw, returnsRaw, custodyRaw, maintenanceRaw, purchasesRaw, suggestionsRaw, notificationsRaw] =
        await Promise.all([
          fetchJson('/api/inventory?limit=500'),
          fetchJson('/api/requests?limit=500'),
          fetchJson('/api/returns?limit=500'),
          fetchJson('/api/custody?limit=500'),
          fetchJson('/api/maintenance?limit=500'),
          fetchJson('/api/purchases?limit=500'),
          fetchJson('/api/suggestions?limit=500'),
          fetchJson('/api/notifications?limit=200'),
        ]);

      if (!mounted) return;

      setData({
        inventoryRaw,
        requestsRaw,
        returnsRaw,
        custodyRaw,
        maintenanceRaw,
        purchasesRaw,
        suggestionsRaw,
        notificationsRaw,
      });
      setLoading(false);
    };

    load();
    return () => {
      mounted = false;
    };
  }, [role]);

  const metrics = useMemo(() => {
    const inventory = getArrayPayload(data.inventoryRaw);
    const requests = getArrayPayload(data.requestsRaw);
    const returns = getArrayPayload(data.returnsRaw);
    const custody = getArrayPayload(data.custodyRaw);
    const maintenance = getArrayPayload(data.maintenanceRaw);
    const purchases = getArrayPayload(data.purchasesRaw);
    const suggestions = getArrayPayload(data.suggestionsRaw);
    const notifications = getArrayPayload(data.notificationsRaw);

    const fallbackLowStock = inventory.filter((item) => {
      const qty = Number(item.availableQty ?? item.availableQuantity ?? item.qty ?? 0);
      return qty > 0 && qty <= 5;
    }).length;

    const fallbackOutOfStock = inventory.filter((item) => {
      const qty = Number(item.availableQty ?? item.availableQuantity ?? item.qty ?? 0);
      return qty <= 0;
    }).length;

    const fallbackReturnableItems = inventory.filter((item) => String(item.type || '').toUpperCase() === 'RETURNABLE').length;
    const fallbackConsumableItems = inventory.filter((item) => String(item.type || '').toUpperCase() === 'CONSUMABLE').length;

    const fallbackPendingRequests = requests.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;
    const fallbackIssuedRequests = requests.filter((item) => String(item.status || '').toUpperCase() === 'ISSUED').length;
    const fallbackRejectedRequests = requests.filter((item) => String(item.status || '').toUpperCase() === 'REJECTED').length;

    const fallbackPendingReturns = returns.filter((item) => String(item.status || '').toUpperCase() === 'PENDING').length;

    const fallbackActiveCustody = custody.filter((item) => String(item.status || '').toUpperCase() === 'ACTIVE').length;
    const fallbackDelayedCustody = custody.filter((item) => {
      const due = item.expectedReturn || item.dueDate;
      if (!due) return false;
      return new Date(due).getTime() < Date.now() && String(item.status || '').toUpperCase() !== 'RETURNED';
    }).length;

    const fallbackOpenMaintenance = maintenance.filter((item) => isOpenStatus(item.status)).length;
    const fallbackOpenPurchases = purchases.filter((item) => isOpenStatus(item.status)).length;
    const fallbackCleaningRequests = suggestions.filter(
      (item) => String(item.category || '').toUpperCase() === 'CLEANING' && isOpenStatus(item.status)
    ).length;
    const fallbackOtherRequests = suggestions.filter(
      (item) => String(item.category || '').toUpperCase() !== 'CLEANING' && isOpenStatus(item.status)
    ).length;

    const fallbackUnreadNotifications = notifications.filter((item) => !item.isRead).length;

    return {
      totalInventory: pickStat(data.inventoryRaw, ['stats.totalItems', 'stats.total', 'pagination.total', 'total', 'count'], inventory.length),
      lowStock: pickStat(data.inventoryRaw, ['stats.lowStock', 'stats.lowStockCount', 'stats.lowStockItems', 'stats.low', 'lowStock'], fallbackLowStock),
      outOfStock: pickStat(data.inventoryRaw, ['stats.outOfStock', 'stats.outOfStockCount', 'stats.outOfStockItems', 'stats.out', 'outOfStock'], fallbackOutOfStock),
      availableInventory: pickStat(data.inventoryRaw, ['stats.available', 'stats.availableItems', 'stats.totalAvailable', 'stats.availableQty', 'available'], Math.max(inventory.length - fallbackOutOfStock, 0)),
      returnableItems: pickStat(data.inventoryRaw, ['stats.returnable', 'stats.returnableItems', 'stats.returnableCount'], fallbackReturnableItems),
      consumableItems: pickStat(data.inventoryRaw, ['stats.consumable', 'stats.consumableItems', 'stats.consumableCount'], fallbackConsumableItems),

      pendingRequests: pickStat(data.requestsRaw, ['stats.pending', 'stats.pendingRequests', 'stats.new', 'stats.open'], fallbackPendingRequests),
      issuedRequests: pickStat(data.requestsRaw, ['stats.issued', 'stats.issuedRequests', 'stats.dispatched'], fallbackIssuedRequests),
      rejectedRequests: pickStat(data.requestsRaw, ['stats.rejected', 'stats.rejectedRequests'], fallbackRejectedRequests),

      pendingReturns: pickStat(data.returnsRaw, ['stats.pending', 'stats.pendingReturns', 'stats.awaitingReceipt'], fallbackPendingReturns),

      activeCustody: pickStat(data.custodyRaw, ['stats.active', 'stats.activeCustody', 'stats.open'], fallbackActiveCustody),
      delayedCustody: pickStat(data.custodyRaw, ['stats.delayed', 'stats.overdue', 'stats.late'], fallbackDelayedCustody),

      openMaintenance: pickStat(data.maintenanceRaw, ['stats.open', 'stats.pending', 'stats.active'], fallbackOpenMaintenance),
      openPurchases: pickStat(data.purchasesRaw, ['stats.open', 'stats.pending', 'stats.active'], fallbackOpenPurchases),
      cleaningRequests: pickStat(data.suggestionsRaw, ['stats.cleaning', 'stats.cleaningRequests'], fallbackCleaningRequests),
      otherRequests: pickStat(data.suggestionsRaw, ['stats.other', 'stats.otherRequests'], fallbackOtherRequests),

      maintenancePending: pickStat(data.suggestionsRaw, ['stats.maintenancePending', 'stats.maintenance', 'stats.maintenanceRequests'], suggestions.filter((item) => String(item.category || '').toUpperCase() === 'MAINTENANCE' && String(item.status || '').toUpperCase() === 'PENDING').length),
      cleaningPending: pickStat(data.suggestionsRaw, ['stats.cleaningPending', 'stats.cleaning', 'stats.cleaningRequests'], suggestions.filter((item) => String(item.category || '').toUpperCase() === 'CLEANING' && String(item.status || '').toUpperCase() === 'PENDING').length),
      purchasePending: pickStat(data.suggestionsRaw, ['stats.purchasePending', 'stats.purchase', 'stats.purchaseRequests'], suggestions.filter((item) => String(item.category || '').toUpperCase() === 'PURCHASE' && String(item.status || '').toUpperCase() === 'PENDING').length),
      otherPending: pickStat(data.suggestionsRaw, ['stats.otherPending', 'stats.other', 'stats.otherRequests'], suggestions.filter((item) => String(item.category || '').toUpperCase() === 'OTHER' && String(item.status || '').toUpperCase() === 'PENDING').length),

      unreadNotifications: pickStat(data.notificationsRaw, ['stats.unread', 'stats.unreadCount', 'unread'], fallbackUnreadNotifications),
      requestItemsCount: pickStat(data.requestsRaw, ['stats.items', 'stats.requestItems', 'stats.totalItems'], countRequestItems(requests)),
    };
  }, [data]);

  const inventoryStatusData = useMemo(
    () => [
      { name: 'متاح', value: Math.max(metrics.availableInventory, 0), color: '#016564' },
      { name: 'منخفض', value: Math.max(metrics.lowStock, 0), color: '#d0b284' },
      { name: 'نافد', value: Math.max(metrics.outOfStock, 0), color: '#7c1e3e' },
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

  const servicesData = useMemo(
    () => [
      { name: 'صيانة', value: metrics.maintenancePending },
      { name: 'شراء مباشر', value: metrics.purchasePending },
      { name: 'نظافة', value: metrics.cleaningPending },
      { name: 'طلبات أخرى', value: metrics.otherPending },
    ],
    [metrics]
  );

  const latestUpdates = useMemo(() => {
    const notifications = getArrayPayload(data.notificationsRaw);
    return notifications
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4);
  }, [data.notificationsRaw]);

  return (
    <DashboardSwitcher
      role={role}
      metrics={metrics}
      inventoryStatusData={inventoryStatusData}
      requestFlowData={requestFlowData}
      servicesData={servicesData}
      latestUpdates={latestUpdates}
      loading={loading}
    />
  );
}

export default function DashboardPage() {
  return <UnifiedDashboard />;
}
