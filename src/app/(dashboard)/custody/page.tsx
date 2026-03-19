'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

type CustodyStatus = 'ACTIVE' | 'OVERDUE' | 'RETURN_REQUESTED' | 'RETURNED';

type ReturnRequestSummary = {
  id: string;
  code: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  conditionNote?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
};

type CustodyItem = {
  id: string;
  code: string;
  itemName: string;
  category?: string | null;
  assignedToUserId: string;
  assignedToUserName: string;
  assignedDate: string;
  dueDate?: string | null;
  notes?: string | null;
  status: CustodyStatus;
  returnRequests: ReturnRequestSummary[];
};

type CustodyApiRow = {
  id: string;
  issueDate: string;
  dueDate?: string | null;
  notes?: string | null;
  status: CustodyStatus;
  userId: string;
  user?: {
    fullName?: string | null;
    department?: string | null;
  } | null;
  item?: {
    name?: string | null;
    code?: string | null;
    category?: string | null;
    type?: 'RETURNABLE' | 'CONSUMABLE' | null;
  } | null;
  returnRequests?: ReturnRequestSummary[];
};

type CustodyApiResponse = {
  data?: CustodyApiRow[];
  pagination?: {
    total: number;
    page: number;
    totalPages: number;
  };
};

function formatDate(date?: string | null) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('ar-SA');
  } catch {
    return '-';
  }
}

function statusLabel(status: CustodyStatus) {
  if (status === 'ACTIVE') return 'نشطة';
  if (status === 'OVERDUE') return 'متأخرة';
  if (status === 'RETURN_REQUESTED') return 'قيد الإرجاع';
  return 'تمت الإعادة';
}

function statusVariant(status: CustodyStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'RETURN_REQUESTED') return 'warning';
  return 'neutral';
}

function mapCustodyRow(row: CustodyApiRow): CustodyItem | null {
  if (row.item?.type && row.item.type !== 'RETURNABLE') return null;
  if (!row.item?.code && !row.item?.name) return null;

  return {
    id: row.id,
    code: row.item?.code || '-',
    itemName: row.item?.name || 'مادة بدون اسم',
    category: row.item?.category || row.user?.department || null,
    assignedToUserId: row.userId,
    assignedToUserName: row.user?.fullName || 'المستخدم',
    assignedDate: row.issueDate,
    dueDate: row.dueDate || null,
    notes: row.notes || null,
    status: row.status,
    returnRequests: Array.isArray(row.returnRequests) ? row.returnRequests : [],
  };
}

export default function CustodyPage() {
  const [items, setItems] = useState<CustodyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submittingReturnId, setSubmittingReturnId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | CustodyStatus>('ALL');
  const [selectedItem, setSelectedItem] = useState<CustodyItem | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/custody', {
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
      });

      const data: CustodyApiResponse = await response.json().catch(() => ({ data: [] }));
      const mapped = Array.isArray(data?.data)
        ? data.data.map(mapCustodyRow).filter(Boolean) as CustodyItem[]
        : [];

      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const stats = useMemo(() => {
    return {
      total: items.filter((i) => i.status !== 'RETURNED').length,
      active: items.filter((i) => i.status === 'ACTIVE' || i.status === 'OVERDUE').length,
      returnRequested: items.filter((i) => i.status === 'RETURN_REQUESTED').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const baseItems = items.filter((item) => item.status !== 'RETURNED');
    if (activeFilter === 'ALL') return baseItems;
    return baseItems.filter((item) => item.status === activeFilter);
  }, [items, activeFilter]);

  const pendingReturnFor = (item: CustodyItem) =>
    item.returnRequests.find((r) => r.status === 'PENDING');

  const createReturnRequest = async (item: CustodyItem) => {
    if (pendingReturnFor(item) || item.status === 'RETURN_REQUESTED') return;

    setSubmittingReturnId(item.id);
    try {
      const response = await fetch('/api/returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          custodyId: item.id,
          returnType: 'GOOD',
          damageDetails: '',
          damageImages: '',
          declarationAck: true,
          notes: '',
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        alert(data?.error || 'تعذر تسجيل طلب الإرجاع');
        return;
      }

      await refresh();
    } finally {
      setSubmittingReturnId(null);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[1.25] text-primary sm:text-[30px]">عهدتي</h1>
            <p className="mt-2 text-[13px] leading-7 text-surface-subtle sm:text-[14px]">
              تظهر هنا المواد المسترجعة فقط، وهي المواد التي استلمتها ولم يتم إرجاعها بعد.
            </p>
          </div>

          <Link href="/requests" className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full sm:w-auto">
              طلب مادة جديدة
            </Button>
          </Link>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-3 sm:mt-5 sm:gap-4">
          <div className="rounded-[20px] border border-surface-border bg-slate-50 p-3 sm:rounded-[22px] sm:p-4">
            <div className="text-[12px] text-surface-subtle sm:text-[13px]">إجمالي العهد الحالية</div>
            <div className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.total}
            </div>
          </div>

          <div className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-3 sm:rounded-[22px] sm:p-4">
            <div className="text-[12px] text-emerald-700 sm:text-[13px]">عهد نشطة</div>
            <div className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.active}
            </div>
          </div>

          <div className="rounded-[20px] border border-amber-200 bg-amber-50 p-3 sm:col-span-2 sm:rounded-[22px] sm:p-4 xl:col-span-1">
            <div className="text-[12px] text-amber-700 sm:text-[13px]">طلبات إرجاع مفتوحة</div>
            <div className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.returnRequested}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 sm:mt-5">
          {[
            { key: 'ALL', label: 'الكل' },
            { key: 'ACTIVE', label: 'نشطة' },
            { key: 'OVERDUE', label: 'متأخرة' },
            { key: 'RETURN_REQUESTED', label: 'قيد الإرجاع' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as 'ALL' | CustodyStatus)}
              className={`min-h-[42px] rounded-full px-4 py-2 text-sm transition ${
                activeFilter === tab.key
                  ? 'bg-[#016564] text-white'
                  : 'border border-slate-200 bg-white text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-2 sm:gap-4">
        {loading ? (
          <Card className="rounded-[24px] p-8 text-center text-slate-500 sm:rounded-[28px] xl:col-span-2">
            جارٍ تحميل العهد...
          </Card>
        ) : filteredItems.length === 0 ? (
          <Card className="rounded-[24px] p-8 text-center text-slate-500 sm:rounded-[28px] xl:col-span-2">
            لا توجد مواد مسترجعة مسجلة عليك حاليًا
          </Card>
        ) : (
          filteredItems.map((item) => {
            const openReturn = pendingReturnFor(item);

            return (
              <Card
                key={item.id}
                className="rounded-[24px] border border-surface-border p-4 shadow-soft sm:rounded-[28px] sm:p-5"
              >
                <div className="flex flex-col gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-700 break-all">
                        {item.code}
                      </span>
                    </div>

                    <h3 className="text-[20px] leading-8 text-primary sm:text-[22px]">
                      {item.itemName}
                    </h3>

                    <div className="mt-3 grid gap-2 rounded-[18px] bg-slate-50 p-3 text-[13px] leading-7 text-slate-600 sm:rounded-[20px] sm:p-4 md:grid-cols-2">
                      <div>
                        الفئة: <span className="text-slate-900">{item.category || '-'}</span>
                      </div>
                      <div>
                        تاريخ الاستلام:{' '}
                        <span className="text-slate-900">{formatDate(item.assignedDate)}</span>
                      </div>
                      <div>
                        موعد الإرجاع:{' '}
                        <span className="text-slate-900">{formatDate(item.dueDate)}</span>
                      </div>
                      <div>
                        حالة الإرجاع:{' '}
                        <span className="text-slate-900">
                          {openReturn ? 'تم رفع طلب إرجاع' : 'لا يوجد'}
                        </span>
                      </div>
                    </div>

                    {item.notes ? (
                      <div className="mt-4 rounded-[18px] border border-surface-border bg-white p-4 text-[13px] leading-7 text-slate-700 whitespace-pre-wrap break-words">
                        {item.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedItem(item)}
                      className="w-full sm:w-auto"
                    >
                      عرض
                    </Button>

                    {item.status === 'RETURN_REQUESTED' || openReturn ? (
                      <Button variant="ghost" disabled className="w-full sm:w-auto">
                        تم رفع طلب إرجاع
                      </Button>
                    ) : (
                      <Button
                        onClick={() => createReturnRequest(item)}
                        className="w-full sm:w-auto"
                        disabled={submittingReturnId === item.id}
                      >
                        {submittingReturnId === item.id ? 'جارٍ الإرسال...' : 'طلب إرجاع'}
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal
        isOpen={!!selectedItem}
        onClose={() => setSelectedItem(null)}
        title="تفاصيل العهدة"
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-surface-border bg-slate-50 p-4 text-[14px] leading-8 text-slate-700 sm:rounded-[20px] break-words">
            <div>
              المادة: <span className="text-slate-900">{selectedItem?.itemName || '-'}</span>
            </div>
            <div>
              الرقم: <span className="text-slate-900">{selectedItem?.code || '-'}</span>
            </div>
            <div>
              الفئة: <span className="text-slate-900">{selectedItem?.category || '-'}</span>
            </div>
            <div>
              تاريخ الاستلام:{' '}
              <span className="text-slate-900">{formatDate(selectedItem?.assignedDate)}</span>
            </div>
            <div>
              موعد الإرجاع:{' '}
              <span className="text-slate-900">{formatDate(selectedItem?.dueDate)}</span>
            </div>
            <div>
              الحالة:{' '}
              <span className="text-slate-900">
                {selectedItem ? statusLabel(selectedItem.status) : '-'}
              </span>
            </div>
          </div>

          {selectedItem?.notes ? (
            <div className="rounded-[18px] border border-surface-border bg-white p-4 text-[14px] leading-8 text-slate-700 whitespace-pre-wrap break-words sm:rounded-[20px]">
              {selectedItem.notes}
            </div>
          ) : null}

          <div className="flex justify-end border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelectedItem(null)}
              className="w-full sm:w-auto"
            >
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}