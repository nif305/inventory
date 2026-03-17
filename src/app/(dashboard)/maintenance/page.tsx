'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

type MaintenanceItem = {
  id: string;
  code: string;
  category: string;
  description: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED' | string;
  notes?: string | null;
  createdAt?: string;
};

function priorityBadge(priority: string) {
  if (priority === 'URGENT') return <Badge variant="danger">عاجلة</Badge>;
  if (priority === 'HIGH') return <Badge variant="warning">عالية</Badge>;
  if (priority === 'NORMAL') return <Badge variant="info">عادية</Badge>;
  return <Badge variant="neutral">منخفضة</Badge>;
}

function statusBadge(status: string) {
  if (status === 'COMPLETED') return <Badge variant="success">مكتملة</Badge>;
  if (status === 'IN_PROGRESS') return <Badge variant="info">قيد المعالجة</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">مرفوضة</Badge>;
  return <Badge variant="warning">بانتظار المعالجة</Badge>;
}

function categoryLabel(category: string) {
  if (category === 'CLEANING') return 'نظافة';
  if (category === 'TECHNICAL') return 'صيانة تقنية';
  return category || 'عام';
}

export default function MaintenancePage() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';

  const [items, setItems] = useState<MaintenanceItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<MaintenanceItem | null>(null);
  const [statusDraft, setStatusDraft] = useState<'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED'>('IN_PROGRESS');
  const [noteDraft, setNoteDraft] = useState('');

  const fetchItems = async () => {
    const res = await fetch('/api/maintenance', { cache: 'no-store' });
    const data = await res.json();
    setItems(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((i) => i.status === 'PENDING').length,
      inProgress: items.filter((i) => i.status === 'IN_PROGRESS').length,
      completed: items.filter((i) => i.status === 'COMPLETED').length,
    };
  }, [items]);

  const handleUpdate = async () => {
    if (!selectedItem) return;

    await fetch('/api/maintenance', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: selectedItem.id,
        status: statusDraft,
        notes: noteDraft,
      }),
    });

    setSelectedItem(null);
    setStatusDraft('IN_PROGRESS');
    setNoteDraft('');
    fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <h1 className="text-[30px] leading-[1.25] text-primary">الصيانة والنظافة</h1>
        <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
          هذا القسم يستقبل فقط الطلبات التي تم تحويلها واعتمادها من “الطلبات الأخرى”.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[13px] text-slate-600">إجمالي البلاغات</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.total}</div>
          </Card>
          <Card className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <div className="text-[13px] text-amber-700">بانتظار المعالجة</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.pending}</div>
          </Card>
          <Card className="rounded-[22px] border border-blue-200 bg-blue-50 p-4">
            <div className="text-[13px] text-blue-700">قيد المعالجة</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.inProgress}</div>
          </Card>
          <Card className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-700">مكتملة</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.completed}</div>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {items.length === 0 ? (
          <Card className="rounded-[28px] border border-dashed border-slate-200 p-10 text-center text-slate-500">
            لا توجد بلاغات حالية
          </Card>
        ) : (
          items.map((item) => (
            <Card key={item.id} className="rounded-[28px] border border-surface-border p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {priorityBadge(item.priority)}
                    {statusBadge(item.status)}
                    <Badge variant="neutral">{categoryLabel(item.category)}</Badge>
                  </div>

                  <h2 className="mt-3 text-[20px] leading-8 text-slate-900">{item.code}</h2>
                  <p className="mt-2 text-[14px] leading-8 text-slate-600">{item.description}</p>

                  {item.notes ? (
                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-[13px] leading-7 text-slate-700">
                      {item.notes}
                    </div>
                  ) : null}
                </div>

                {isManager ? (
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSelectedItem(item);
                      setStatusDraft((item.status as any) || 'IN_PROGRESS');
                      setNoteDraft(item.notes || '');
                    }}
                  >
                    تحديث الحالة
                  </Button>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={Boolean(selectedItem)} onClose={() => setSelectedItem(null)} title="تحديث حالة البلاغ">
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-primary">الحالة</label>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as any)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="PENDING">بانتظار المعالجة</option>
              <option value="IN_PROGRESS">قيد المعالجة</option>
              <option value="COMPLETED">مكتملة</option>
              <option value="REJECTED">مرفوضة</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">ملاحظات التحديث</label>
            <textarea
              rows={4}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
          </div>

          <div className="flex justify-end">
            <Button onClick={handleUpdate}>حفظ التحديث</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}