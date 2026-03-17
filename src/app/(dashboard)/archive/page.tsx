'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type RequestItem = {
  id: string;
  itemId: string;
  quantity: number;
  expectedReturnDate?: string | null;
  activeIssuedQty?: number;
  item?: {
    id?: string;
    name?: string;
    code?: string;
    type?: 'RETURNABLE' | 'CONSUMABLE';
    unit?: string | null;
  };
};

type ArchiveRequest = {
  id: string;
  code: string;
  purpose: string;
  notes?: string | null;
  status: 'REJECTED' | 'ISSUED' | 'RETURNED' | 'PENDING';
  createdAt: string;
  rejectionReason?: string | null;
  requester?: {
    fullName?: string;
    department?: string;
    email?: string;
  };
  items?: RequestItem[];
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  REJECTED: { label: 'ملغي / مرفوض', variant: 'danger' },
  ISSUED: { label: 'تم الصرف', variant: 'success' },
  RETURNED: { label: 'تمت الإعادة', variant: 'neutral' },
  PENDING: { label: 'جديد', variant: 'warning' },
};

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-[#e7ebea] bg-white px-4 py-3">
      <div className="text-xs font-bold text-[#016564]">{label}</div>
      <div className="text-sm text-[#304342]">{value}</div>
    </div>
  );
}

export default function ArchivePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ArchiveRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ISSUED' | 'RETURNED' | 'REJECTED'>('ALL');
  const [selected, setSelected] = useState<ArchiveRequest | null>(null);

  const canViewAll = user?.role === 'manager' || user?.role === 'warehouse';

  useEffect(() => {
    let mounted = true;

    async function fetchArchive() {
      setLoading(true);
      try {
        const res = await fetch('/api/requests', { cache: 'no-store' });
        const data = await res.json();
        const allRows = Array.isArray(data?.data) ? data.data : [];

        const finishedRows = allRows.filter((row: ArchiveRequest) =>
          ['ISSUED', 'RETURNED', 'REJECTED'].includes(row.status)
        );

        if (mounted) {
          setRows(finishedRows);
        }
      } catch {
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    fetchArchive();
    return () => {
      mounted = false;
    };
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalizeArabic(search);

    return rows.filter((row) => {
      const matchesStatus = statusFilter === 'ALL' ? true : row.status === statusFilter;

      const haystack = normalizeArabic(
        [
          row.code,
          row.purpose,
          row.requester?.fullName,
          row.requester?.department,
          ...(row.items || []).map((item) => item.item?.name || ''),
        ]
          .filter(Boolean)
          .join(' ')
      );

      const matchesSearch = q ? haystack.includes(q) : true;
      return matchesStatus && matchesSearch;
    });
  }, [rows, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      issued: rows.filter((row) => row.status === 'ISSUED').length,
      returned: rows.filter((row) => row.status === 'RETURNED').length,
      rejected: rows.filter((row) => row.status === 'REJECTED').length,
    };
  }, [rows]);

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d6d7d4] bg-white px-5 py-5 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#016564]">الأرشيف</h1>
          <p className="text-sm text-[#61706f]">
            مراجعة الطلبات المنتهية وفتح تفاصيل كل معاملة لمعرفة ما صُرف وما أُعيد وما انتهت إليه الحالة.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">إجمالي المعاملات</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">{stats.total}</div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">تم الصرف</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">{stats.issued}</div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">تمت الإعادة</div>
            <div className="mt-1 text-xl font-extrabold text-[#498983]">{stats.returned}</div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">ملغاة / مرفوضة</div>
            <div className="mt-1 text-xl font-extrabold text-[#7c1e3e]">{stats.rejected}</div>
          </Card>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_180px]">
          <Input
            label="بحث"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="رقم الطلب، الغرض، اسم الموظف، أو اسم المادة"
          />

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-slate-700">الحالة</label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as 'ALL' | 'ISSUED' | 'RETURNED' | 'REJECTED')
              }
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
            >
              <option value="ALL">الكل</option>
              <option value="ISSUED">تم الصرف</option>
              <option value="RETURNED">تمت الإعادة</option>
              <option value="REJECTED">ملغاة / مرفوضة</option>
            </select>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-28 w-full rounded-3xl" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="rounded-[28px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">
            لا توجد معاملات مؤرشفة مطابقة
          </Card>
        ) : (
          filteredRows.map((row) => {
            const statusMeta = STATUS_MAP[row.status] || {
              label: row.status,
              variant: 'neutral' as const,
            };

            const totalQty = (row.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);
            const returnableCount = (row.items || []).filter(
              (item) => item.item?.type === 'RETURNABLE'
            ).length;
            const consumableCount = (row.items || []).filter(
              (item) => item.item?.type !== 'RETURNABLE'
            ).length;

            return (
              <Card
                key={row.id}
                className="rounded-[28px] border border-[#d6d7d4] p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="font-mono text-sm font-bold text-[#016564]">{row.code}</div>
                      <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                    </div>

                    <div className="text-base font-bold text-[#152625]">{row.purpose}</div>

                    <div className="grid gap-2 text-xs text-[#61706f] sm:grid-cols-2">
                      <div>التاريخ: {formatDate(row.createdAt)}</div>
                      <div>إجمالي الكمية: {totalQty}</div>
                      {canViewAll ? <div>الموظف: {row.requester?.fullName || '—'}</div> : null}
                      {canViewAll ? <div>الإدارة: {row.requester?.department || '—'}</div> : null}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {returnableCount > 0 ? (
                        <Badge variant="info">مواد مسترجعة: {returnableCount}</Badge>
                      ) : null}
                      {consumableCount > 0 ? (
                        <Badge variant="neutral">مواد استهلاكية: {consumableCount}</Badge>
                      ) : null}
                    </div>

                    {row.rejectionReason ? (
                      <div className="rounded-2xl border border-[#f0d7dd] bg-[#fff7f8] px-4 py-3 text-sm text-[#7c1e3e]">
                        سبب الإلغاء / الرفض: {row.rejectionReason}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <Button className="w-full sm:w-auto" onClick={() => setSelected(row)}>
                      فتح التفاصيل
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `تفاصيل المعاملة ${selected.code}` : 'تفاصيل المعاملة'}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <DetailRow label="رقم الطلب" value={selected.code} />
              <DetailRow
                label="الحالة النهائية"
                value={
                  <Badge
                    variant={(STATUS_MAP[selected.status]?.variant || 'neutral') as
                      | 'neutral'
                      | 'success'
                      | 'warning'
                      | 'danger'
                      | 'info'}
                  >
                    {STATUS_MAP[selected.status]?.label || selected.status}
                  </Badge>
                }
              />
              <DetailRow label="الغرض" value={selected.purpose} />
              <DetailRow label="التاريخ" value={formatDate(selected.createdAt)} />
              {canViewAll ? (
                <DetailRow label="الموظف" value={selected.requester?.fullName || '—'} />
              ) : null}
              {canViewAll ? (
                <DetailRow label="الإدارة" value={selected.requester?.department || '—'} />
              ) : null}
            </div>

            {selected.notes ? (
              <div className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] px-4 py-3">
                <div className="text-xs font-bold text-[#016564]">ملاحظات</div>
                <div className="mt-2 text-sm text-[#304342]">{selected.notes}</div>
              </div>
            ) : null}

            {selected.rejectionReason ? (
              <div className="rounded-2xl border border-[#f0d7dd] bg-[#fff7f8] px-4 py-3">
                <div className="text-xs font-bold text-[#7c1e3e]">سبب الإلغاء / الرفض</div>
                <div className="mt-2 text-sm text-[#7c1e3e]">{selected.rejectionReason}</div>
              </div>
            ) : null}

            <div className="rounded-2xl border border-[#e7ebea] bg-white">
              <div className="border-b border-[#eef1f1] px-4 py-3 text-sm font-bold text-[#016564]">
                المواد المرتبطة بالمعاملة
              </div>

              <div className="space-y-3 p-4">
                {(selected.items || []).length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-6 text-center text-sm text-[#61706f]">
                    لا توجد مواد مرتبطة
                  </div>
                ) : (
                  (selected.items || []).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-2xl border border-[#e7ebea] bg-[#fcfcfc] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="text-sm font-semibold text-[#152625]">
                            {item.item?.name || 'مادة'}
                          </div>
                          <div className="text-xs text-[#61706f]">
                            الكمية المصروفة: {item.quantity}
                            {item.item?.unit ? ` ${item.item.unit}` : ''}
                          </div>
                          {item.expectedReturnDate ? (
                            <div className="text-xs text-[#61706f]">
                              الإرجاع المتوقع: {formatDate(item.expectedReturnDate)}
                            </div>
                          ) : null}
                          {(item.activeIssuedQty || 0) > 0 ? (
                            <div className="text-xs text-[#016564]">
                              المتبقي غير المعاد: {item.activeIssuedQty}
                            </div>
                          ) : null}
                        </div>

                        <Badge variant={item.item?.type === 'RETURNABLE' ? 'info' : 'neutral'}>
                          {item.item?.type === 'RETURNABLE' ? 'مسترجعة' : 'استهلاكية'}
                        </Badge>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setSelected(null)}>
                إغلاق
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}