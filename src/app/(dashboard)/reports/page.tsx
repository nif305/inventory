'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { Input } from '@/components/ui/Input';

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

function normalizeArabic(value: string) {
  return (value || '')
    .toLowerCase()
    .trim()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ء/g, '')
    .replace(/\s+/g, ' ');
}

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
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4">
        <h2 className="text-lg font-extrabold text-[#016564]">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-[#61706f]">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default function ReportsPage() {
  const [data, setData] = useState<ReportPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [employeeSearch, setEmployeeSearch] = useState('');

  useEffect(() => {
    let mounted = true;

    async function fetchReports() {
      setLoading(true);
      try {
        const res = await fetch('/api/reports/summary', { cache: 'no-store' });
        const payload = await res.json();
        if (mounted) {
          setData(payload);
        }
      } catch {
        if (mounted) {
          setData(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    fetchReports();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredUserConsumption = useMemo(() => {
    const q = normalizeArabic(employeeSearch);
    if (!data?.userConsumption) return [];

    return data.userConsumption.filter((row) => {
      const haystack = normalizeArabic([row.fullName, row.department].filter(Boolean).join(' '));
      return q ? haystack.includes(q) : true;
    });
  }, [employeeSearch, data]);

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-[24px]" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[28px]" />
        <Skeleton className="h-64 w-full rounded-[28px]" />
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="rounded-[28px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">
        تعذر تحميل التقارير
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d6d7d4] bg-white px-5 py-5 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#016564]">التقارير والتحليلات</h1>
          <p className="text-sm text-[#61706f]">
            مؤشرات تشغيلية قابلة للاحتكام توضح المصروف، المستهلك، المسترجع، وأكثر المواد والمستخدمين نشاطًا.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricCard title="إجمالي المواد" value={data.totalItems} />
          <MetricCard
            title="عهد نشطة"
            value={data.activeCustody}
            note={`إجمالي الكمية: ${data.activeCustodyQuantity}`}
          />
          <MetricCard title="صحة المخزون" value={`${data.healthPercentage}%`} />
          <MetricCard title="طلبات بانتظار التنفيذ" value={data.pendingRequests} />
        </div>
      </section>

      <SectionCard title="ملخص السنة الحالية" subtitle="من بداية السنة حتى تاريخه">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard title="إجمالي المواد المصروفة" value={data.totalIssuedQuantityYTD} />
          <MetricCard title="إجمالي المواد المستهلكة" value={data.totalConsumedQuantityYTD} />
          <MetricCard title="إجمالي المواد المسترجعة" value={data.totalReturnedQuantityYTD} />
          <MetricCard title="طلبات منتهية بالصرف" value={data.totalIssuedRequests} />
          <MetricCard title="طلبات منتهية بالإرجاع" value={data.totalReturnedRequests} />
          <MetricCard title="مواد منخفضة المخزون" value={data.lowStockItems} />
          <MetricCard title="مواد نافدة" value={data.outOfStockItems} />
          <MetricCard title="طلبات ملغاة / مرفوضة" value={data.rejectedRequests} />
        </div>
      </SectionCard>

      <div className="grid gap-5 xl:grid-cols-2">
        <SectionCard
          title="أكثر المواد استهلاكًا"
          subtitle="أعلى المواد الاستهلاكية صرفًا من بداية السنة"
        >
          {data.topConsumedItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
              لا توجد بيانات كافية
            </div>
          ) : (
            <div className="space-y-3">
              {data.topConsumedItems.map((item, index) => (
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

        <SectionCard
          title="أكثر المستخدمين سحبًا للمواد"
          subtitle="بحسب إجمالي المواد المصروفة لهم"
        >
          {data.topIssuedUsers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
              لا توجد بيانات كافية
            </div>
          ) : (
            <div className="space-y-3">
              {data.topIssuedUsers.map((user, index) => (
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

      <SectionCard
        title="استهلاك كل مستخدم"
        subtitle="ابحث باسم الموظف لمعرفة كمية المواد الاستهلاكية المصروفة له"
      >
        <div className="mb-4">
          <Input
            label="بحث عن موظف"
            value={employeeSearch}
            onChange={(e) => setEmployeeSearch(e.target.value)}
            placeholder="اكتب اسم الموظف أو الإدارة"
          />
        </div>

        {filteredUserConsumption.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
            لا توجد نتائج مطابقة
          </div>
        ) : (
          <div className="space-y-3">
            {filteredUserConsumption.map((user) => (
              <div
                key={user.userId}
                className="flex flex-col gap-3 rounded-2xl border border-[#e7ebea] bg-white p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-1">
                  <div className="text-sm font-semibold text-[#152625]">{user.fullName}</div>
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