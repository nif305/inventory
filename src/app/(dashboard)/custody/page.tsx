'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';
import { broadcastNotification, createNotification } from '@/lib/notifications';

type CustodyStatus = 'ACTIVE' | 'DUE_SOON' | 'OVERDUE' | 'RETURN_REQUESTED' | 'RETURNED';

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
};

type ReturnRequest = {
  id: string;
  custodyId: string;
  userId: string;
  returnType?: string | null;
  conditionNote?: string | null;
  damageDetails?: string | null;
  damageImages?: string | null;
  declarationAck?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

const CUSTODY_STORAGE_KEY = 'inventory_custody_items';
const RETURNS_STORAGE_KEY = 'inventory_returns';

function formatDate(date?: string | null) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleDateString('ar-SA');
  } catch {
    return '-';
  }
}

function loadCustody(): CustodyItem[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CUSTODY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveCustody(items: CustodyItem[]) {
  localStorage.setItem(CUSTODY_STORAGE_KEY, JSON.stringify(items));
}

function loadReturns(): ReturnRequest[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(RETURNS_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveReturns(items: ReturnRequest[]) {
  localStorage.setItem(RETURNS_STORAGE_KEY, JSON.stringify(items));
}

function computeStatus(item: CustodyItem, openReturn?: ReturnRequest): CustodyStatus {
  if (item.status === 'RETURNED') return 'RETURNED';
  if (openReturn && openReturn.status === 'PENDING') return 'RETURN_REQUESTED';
  if (!item.dueDate) return 'ACTIVE';

  const today = new Date();
  const due = new Date(item.dueDate);
  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'OVERDUE';
  if (diffDays <= 7) return 'DUE_SOON';
  return 'ACTIVE';
}

function statusLabel(status: CustodyStatus) {
  if (status === 'ACTIVE') return 'نشطة';
  if (status === 'DUE_SOON') return 'موعد قريب';
  if (status === 'OVERDUE') return 'متأخرة';
  if (status === 'RETURN_REQUESTED') return 'قيد الإرجاع';
  return 'تمت الإعادة';
}

function statusVariant(status: CustodyStatus): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DUE_SOON') return 'warning';
  if (status === 'OVERDUE') return 'danger';
  return 'neutral';
}

export default function CustodyPage() {
  const { user, originalUser } = useAuth();

  const effectiveUserId = originalUser?.id || user?.id || '';

  const [items, setItems] = useState<CustodyItem[]>([]);
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [activeFilter, setActiveFilter] = useState<'ALL' | CustodyStatus>('ALL');
  const [selectedItem, setSelectedItem] = useState<CustodyItem | null>(null);

  const refresh = () => {
    const loadedCustody = loadCustody();
    const loadedReturns = loadReturns();

    const visible = loadedCustody
      .filter((item) => item.assignedToUserId === effectiveUserId)
      .map((item) => {
        const openReturn = loadedReturns.find(
          (r) => r.custodyId === item.id && r.userId === effectiveUserId && r.status === 'PENDING'
        );

        return {
          ...item,
          status: computeStatus(item, openReturn),
        };
      })
      .sort((a, b) => (b.assignedDate || '').localeCompare(a.assignedDate || ''));

    setItems(visible);
    setReturns(loadedReturns);
  };

  useEffect(() => {
    if (effectiveUserId) refresh();
  }, [effectiveUserId]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      active: items.filter((i) => i.status === 'ACTIVE' || i.status === 'DUE_SOON' || i.status === 'OVERDUE').length,
      returnRequested: items.filter((i) => i.status === 'RETURN_REQUESTED').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeFilter === 'ALL') return items;
    return items.filter((item) => item.status === activeFilter);
  }, [items, activeFilter]);

  const pendingReturnFor = (custodyId: string) =>
    returns.find(
      (r) => r.custodyId === custodyId && r.userId === effectiveUserId && r.status === 'PENDING'
    );

  const createReturnRequest = (item: CustodyItem) => {
    const existing = pendingReturnFor(item.id);
    if (existing) return;

    const newReturn: ReturnRequest = {
      id: `ret_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      custodyId: item.id,
      userId: effectiveUserId,
      returnType: 'GOOD',
      conditionNote: '',
      damageDetails: '',
      damageImages: '',
      declarationAck: true,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };

    const updatedReturns = [newReturn, ...loadReturns()];
    saveReturns(updatedReturns);

    const updatedCustody = loadCustody().map((c) =>
      c.id === item.id ? { ...c, status: 'RETURN_REQUESTED' as CustodyStatus } : c
    );
    saveCustody(updatedCustody);

    if (effectiveUserId) {
      createNotification({
        userId: effectiveUserId,
        kind: 'notification',
        severity: 'info',
        title: 'تم تسجيل طلب الإرجاع',
        message: `تم تسجيل طلب إرجاع للمادة ${item.itemName} وهو الآن بانتظار الاستلام والتوثيق.`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: newReturn.id,
        dedupeKey: `return-created-user-${newReturn.id}`,
      });
    }

    broadcastNotification({
      roles: ['manager', 'warehouse'],
      kind: 'alert',
      severity: 'action',
      title: 'طلب إرجاع جديد',
      message: `تم رفع طلب إرجاع جديد للمادة ${item.itemName}.`,
      link: '/returns',
      entityType: 'RETURN',
      entityId: newReturn.id,
      dedupeKey: `return-created-admin-${newReturn.id}`,
    });

    refresh();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-[1.25] text-primary">عهدتي</h1>
            <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
              عرض المواد المسجلة عليك حاليًا، مع توضيح حالتها وتسهيل رفع طلب الإرجاع عند الحاجة.
            </p>
          </div>

          <Link href="/requests">
            <Button variant="ghost">طلب مادة جديدة</Button>
          </Link>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-surface-border bg-slate-50 p-4">
            <div className="text-[13px] text-surface-subtle">إجمالي المواد</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.total}</div>
          </div>

          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-700">مواد حالية</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.active}</div>
          </div>

          <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <div className="text-[13px] text-amber-700">طلبات إرجاع مفتوحة</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.returnRequested}</div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'الكل' },
            { key: 'ACTIVE', label: 'نشطة' },
            { key: 'DUE_SOON', label: 'موعد قريب' },
            { key: 'OVERDUE', label: 'متأخرة' },
            { key: 'RETURN_REQUESTED', label: 'قيد الإرجاع' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key as 'ALL' | CustodyStatus)}
              className={`rounded-full px-4 py-2 text-sm transition ${
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

      <div className="grid gap-4 xl:grid-cols-2">
        {filteredItems.length === 0 ? (
          <Card className="rounded-[28px] p-8 text-center text-slate-500 xl:col-span-2">
            لا توجد مواد مسجلة عليك حاليًا
          </Card>
        ) : (
          filteredItems.map((item) => {
            const openReturn = pendingReturnFor(item.id);

            return (
              <Card
                key={item.id}
                className="rounded-[28px] border border-surface-border p-5 shadow-soft"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Badge variant={statusVariant(item.status)}>{statusLabel(item.status)}</Badge>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-700">
                        {item.code}
                      </span>
                    </div>

                    <h3 className="text-[22px] leading-8 text-primary">{item.itemName}</h3>

                    <div className="mt-3 grid gap-2 text-[13px] leading-7 text-slate-600 md:grid-cols-2">
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
                          {openReturn ? 'تم رفع طلب إرجاع' : item.status === 'RETURNED' ? 'تمت الإعادة' : 'لا يوجد'}
                        </span>
                      </div>
                    </div>

                    {item.notes ? (
                      <div className="mt-4 rounded-[18px] border border-surface-border bg-slate-50 p-4 text-[13px] leading-7 text-slate-700">
                        {item.notes}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 gap-2">
                    <Button variant="ghost" onClick={() => setSelectedItem(item)}>
                      عرض
                    </Button>

                    {item.status === 'RETURN_REQUESTED' || openReturn ? (
                      <Button variant="ghost" disabled>
                        تم رفع طلب إرجاع
                      </Button>
                    ) : item.status === 'RETURNED' ? (
                      <Button variant="ghost" disabled>
                        تمت الإعادة
                      </Button>
                    ) : (
                      <Button onClick={() => createReturnRequest(item)}>طلب إرجاع</Button>
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
          <div className="rounded-[20px] border border-surface-border bg-slate-50 p-4 text-[14px] leading-8 text-slate-700">
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
              الحالة: <span className="text-slate-900">{selectedItem ? statusLabel(selectedItem.status) : '-'}</span>
            </div>
          </div>

          {selectedItem?.notes ? (
            <div className="rounded-[20px] border border-surface-border bg-white p-4 text-[14px] leading-8 text-slate-700 whitespace-pre-wrap">
              {selectedItem.notes}
            </div>
          ) : null}

          <div className="flex justify-end border-t pt-4">
            <Button type="button" variant="ghost" onClick={() => setSelectedItem(null)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}