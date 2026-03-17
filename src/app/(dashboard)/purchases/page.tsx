'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import Link from 'next/link';

type TopItemRow = {
  itemId: string;
  name: string;
  code: string;
  quantity: number;
};

type TopUserRow = {
  userId: string;
  fullName: string;
  department: string;
  quantity: number;
};

type ReportPayload = {
  totalItems: number;
  lowStockItems: number;
  outOfStockItems: number;
  activeCustody: number;
  activeCustodyQuantity: number;
  pendingRequests: number;
  rejectedRequests: number;
  totalIssuedRequests: number;
  totalReturnedRequests: number;
  totalIssuedQuantityYTD: number;
  totalConsumedQuantityYTD: number;
  totalReturnedQuantityYTD: number;
  healthPercentage: number;
  topConsumedItems: TopItemRow[];
  topIssuedUsers: TopUserRow[];
  userConsumption: TopUserRow[];
};

function MetricCard({
  title,
  value,
  note,
}: {
  title: string;
  value: number | string;
  note?: string;
}) {
  return (
    <Card className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-none">
      <div className="text-xs text-[#6f7b7a]">{title}</div>
      <div className="mt-2 text-2xl font-extrabold text-[#016564]">{value}</div>
      {note ? <div className="mt-2 text-xs text-[#7a8786]">{note}</div> : null}
    </Card>
  );
}

function SectionCard({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-extrabold text-[#016564]">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function fetchSummary() {
      setLoading(true);
      try {
        const res = await fetch('/api/reports/summary', { cache: 'no-store' });
        const payload = await res.json();
        if (mounted) setData(payload);
      } catch {
        if (mounted) setData(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchSummary();
    return () => {
      mounted = false;
    };
  }, []);

  const quickStatus = useMemo(() => {
    if (!data) return { tone: 'neutral', text: 'لا توجد بيانات كافية' };

    if (data.outOfStockItems > 0) {
      return { tone: 'danger', text: 'يوجد مواد نافدة تحتاج معالجة عاجلة' };
    }

    if (data.lowStockItems > 0) {
      return { tone: 'warning', text: 'المخزون مستقر جزئيًا مع وجود مواد منخفضة' };
    }

    return { tone: 'success', text: 'وضع المخزون مستقر حاليًا' };
  }, [data]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-[28px]" />
        <Skeleton className="h-72 w-full rounded-[28px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-[28px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">
        تعذر تحميل لوحة المعلومات
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d6d7d4] bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#016564]">لوحة المعلومات</h1>
            <p className="text-sm text-[#61706f]">
              نظرة تشغيلية مختصرة على حالة المخزون والطلبات والحركة السنوية.
            </p>
          </div>

          <Badge
            variant={
              quickStatus.tone === 'danger'
                ? 'danger'
                : quickStatus.tone === 'warning'
                ? 'warning'
                : 'success'
            }
          >
            {quickStatus.text}
          </Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard title="إجمالي المواد" value={data.totalItems} />
          <MetricCard title="عهد نشطة" value={data.activeCustody} note={`إجمالي الكمية: ${data.activeCustodyQuantity}`} />
          <MetricCard title="طلبات جديدة" value={data.pendingRequests} />
          <MetricCard title="صحة المخزون" value={`${data.healthPercentage}%`} />
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="مؤشرات سريعة"
          action={
            <Link href="/reports">
              <Button variant="secondary" className="w-full sm:w-auto">
                عرض التقارير الكاملة
              </Button>
            </Link>
          }
        >
          <div className="grid grid-cols-2 gap-3">
            <MetricCard title="مواد منخفضة" value={data.lowStockItems} />
            <MetricCard title="مواد نافدة" value={data.outOfStockItems} />
            <MetricCard title="المصروف هذا العام" value={data.totalIssuedQuantityYTD} />
            <MetricCard title="المسترجع هذا العام" value={data.totalReturnedQuantityYTD} />
            <MetricCard title="المستهلك هذا العام" value={data.totalConsumedQuantityYTD} />
            <MetricCard title="طلبات مرفوضة" value={data.rejectedRequests} />
          </div>
        </SectionCard>

        <SectionCard title="أكثر المواد استهلاكًا">
          {data.topConsumedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
              لا توجد بيانات كافية
            </div>
          ) : (
            <div className="space-y-3">
              {data.topConsumedItems.slice(0, 5).map((item, index) => (
                <div
                  key={item.itemId}
                  className="flex flex-col gap-3 rounded-2xl border border-[#e7ebea] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="neutral">#{index + 1}</Badge>
                      <div className="text-sm font-semibold text-[#152625]">{item.name}</div>
                    </div>
                    <div className="text-xs text-[#61706f]">الكود: {item.code || '—'}</div>
                  </div>

                  <div className="text-sm font-bold text-[#016564]">{item.quantity}</div>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <SectionCard title="أكثر المستخدمين سحبًا للمواد">
        {data.topIssuedUsers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
            لا توجد بيانات كافية
          </div>
        ) : (
          <div className="space-y-3">
            {data.topIssuedUsers.slice(0, 6).map((user, index) => (
              <div
                key={user.userId}
                className="flex flex-col gap-3 rounded-2xl border border-[#e7ebea] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="neutral">#{index + 1}</Badge>
                    <div className="text-sm font-semibold text-[#152625]">{user.fullName}</div>
                  </div>
                  <div className="text-xs text-[#61706f]">{user.department || '—'}</div>
                </div>

                <div className="text-sm font-bold text-[#016564]">{user.quantity}</div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>
    </div>
  );
}