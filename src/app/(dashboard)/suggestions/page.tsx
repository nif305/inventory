'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';

type SuggestionItem = {
  id: string;
  title: string;
  description: string;
  justification: string;
  category: 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER' | string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | string;
  status: 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | string;
  adminNotes?: string | null;
  createdAt: string;
  requesterId: string;
  requester?: {
    fullName?: string;
    department?: string;
    role?: string;
  } | null;
};

type FilterKey = 'ALL' | 'PENDING' | 'IMPLEMENTED' | 'REJECTED';
type CategoryFilter = 'ALL' | 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';
type SuggestionCategory = 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';

function categoryLabel(category: string) {
  if (category === 'MAINTENANCE') return 'طلب صيانة';
  if (category === 'CLEANING') return 'طلب نظافة';
  if (category === 'PURCHASE') return 'طلب شراء مباشر';
  return 'طلب آخر';
}

function categoryBadge(category: string) {
  if (category === 'MAINTENANCE') return <Badge variant="warning">طلب صيانة</Badge>;
  if (category === 'CLEANING') return <Badge variant="info">طلب نظافة</Badge>;
  if (category === 'PURCHASE') return <Badge variant="success">طلب شراء مباشر</Badge>;
  return <Badge variant="neutral">طلب آخر</Badge>;
}

function statusBadge(status: string) {
  if (status === 'IMPLEMENTED') return <Badge variant="success">تم التحويل</Badge>;
  if (status === 'REJECTED') return <Badge variant="danger">مرفوض</Badge>;
  if (status === 'UNDER_REVIEW') return <Badge variant="info">قيد المراجعة</Badge>;
  if (status === 'APPROVED') return <Badge variant="success">معتمد</Badge>;
  return <Badge variant="warning">بانتظار القرار</Badge>;
}

function priorityBadge(priority: string) {
  if (priority === 'URGENT') return <Badge variant="danger">عاجلة</Badge>;
  if (priority === 'HIGH') return <Badge variant="warning">عالية</Badge>;
  if (priority === 'NORMAL') return <Badge variant="info">عادية</Badge>;
  return <Badge variant="neutral">منخفضة</Badge>;
}

function parseMeta(value?: string | null) {
  try {
    return JSON.parse(value || '{}');
  } catch {
    return {};
  }
}

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ar-SA');
  } catch {
    return value;
  }
}

function normalizeTypeParam(value: string | null): SuggestionCategory {
  if (value === 'MAINTENANCE') return 'MAINTENANCE';
  if (value === 'CLEANING') return 'CLEANING';
  if (value === 'PURCHASE') return 'PURCHASE';
  return 'OTHER';
}

export default function SuggestionsPage() {
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const searchParams = useSearchParams();
  const router = useRouter();

  const [items, setItems] = useState<SuggestionItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('ALL');
  const [search, setSearch] = useState('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SuggestionItem | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [estimatedValue, setEstimatedValue] = useState('');
  const [targetDepartment, setTargetDepartment] = useState('SUPPORT_SERVICES');

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<SuggestionCategory>('MAINTENANCE');
  const [priority, setPriority] = useState<'LOW' | 'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [itemName, setItemName] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [justification, setJustification] = useState('');
  const [externalRecipient, setExternalRecipient] = useState('');

  const fetchItems = async () => {
    const res = await fetch('/api/suggestions', { cache: 'no-store' });
    const data = await res.json();
    setItems(Array.isArray(data?.data) ? data.data : []);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    const shouldOpen = searchParams.get('new') === '1';
    if (!shouldOpen || isManager) return;

    const incomingType = normalizeTypeParam(searchParams.get('type'));
    setCategory(incomingType);
    setIsModalOpen(true);
  }, [searchParams, isManager]);

  const closeCreateModal = () => {
    setIsModalOpen(false);
    if (searchParams.get('new') === '1') {
      router.replace('/suggestions');
    }
  };

  const stats = useMemo(() => {
    return {
      total: items.length,
      pending: items.filter((i) => i.status === 'PENDING').length,
      implemented: items.filter((i) => i.status === 'IMPLEMENTED').length,
      rejected: items.filter((i) => i.status === 'REJECTED').length,
      maintenance: items.filter((i) => i.category === 'MAINTENANCE').length,
      cleaning: items.filter((i) => i.category === 'CLEANING').length,
      purchase: items.filter((i) => i.category === 'PURCHASE').length,
      other: items.filter((i) => i.category === 'OTHER').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();

    return items.filter((item) => {
      const meta = parseMeta(item.justification);

      const matchesFilter = filter === 'ALL' ? true : item.status === filter;
      const matchesCategory = categoryFilter === 'ALL' ? true : item.category === categoryFilter;
      const matchesSearch =
        !q ||
        [
          item.title,
          item.description,
          item.requester?.fullName,
          item.requester?.department,
          meta.itemName,
          meta.location,
          meta.rawJustification,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(q));

      return matchesFilter && matchesCategory && matchesSearch;
    });
  }, [items, filter, categoryFilter, search]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();

    await fetch('/api/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        category,
        priority,
        itemName,
        quantity: Number(quantity || 1),
        location,
        description,
        justification,
        externalRecipient,
        targetDepartment,
      }),
    });

    closeCreateModal();
    setTitle('');
    setCategory('MAINTENANCE');
    setPriority('NORMAL');
    setItemName('');
    setQuantity('1');
    setLocation('');
    setDescription('');
    setJustification('');
    setExternalRecipient('');
    fetchItems();
  };

  const handleManagerAction = async (action: 'approve' | 'reject') => {
    if (!selectedItem) return;

    await fetch('/api/suggestions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        suggestionId: selectedItem.id,
        action,
        adminNotes,
        targetDepartment,
        estimatedValue: estimatedValue ? Number(estimatedValue) : undefined,
      }),
    });

    setSelectedItem(null);
    setAdminNotes('');
    setEstimatedValue('');
    fetchItems();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-[1.25] text-primary">الطلبات الأخرى</h1>
            <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
              بوابة موحدة لرفع طلب صيانة، طلب نظافة، طلب شراء مباشر، أو أي طلب آخر، مع استقبال ذكي عند المدير.
            </p>
          </div>

          <Button onClick={() => setIsModalOpen(true)}>طلب جديد</Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4 xl:grid-cols-8">
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[13px] text-slate-600">الإجمالي</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.total}</div>
          </Card>
          <Card className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <div className="text-[13px] text-amber-700">بانتظار القرار</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.pending}</div>
          </Card>
          <Card className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-700">تم التحويل</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.implemented}</div>
          </Card>
          <Card className="rounded-[22px] border border-rose-200 bg-rose-50 p-4">
            <div className="text-[13px] text-rose-700">مرفوضة</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.rejected}</div>
          </Card>
          <Card className="rounded-[22px] border border-orange-200 bg-orange-50 p-4">
            <div className="text-[13px] text-orange-700">الصيانة</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.maintenance}</div>
          </Card>
          <Card className="rounded-[22px] border border-sky-200 bg-sky-50 p-4">
            <div className="text-[13px] text-sky-700">النظافة</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.cleaning}</div>
          </Card>
          <Card className="rounded-[22px] border border-teal-200 bg-teal-50 p-4">
            <div className="text-[13px] text-teal-700">الشراء</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.purchase}</div>
          </Card>
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <div className="text-[13px] text-slate-600">أخرى</div>
            <div className="mt-2 text-[28px] leading-none text-slate-900">{stats.other}</div>
          </Card>
        </div>

        <div className="mt-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { key: 'ALL', label: 'الكل' },
              { key: 'PENDING', label: 'بانتظار القرار' },
              { key: 'IMPLEMENTED', label: 'تم التحويل' },
              { key: 'REJECTED', label: 'المرفوضة' },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setFilter(tab.key as FilterKey)}
                className={`rounded-full px-4 py-2 text-sm transition ${
                  filter === tab.key ? 'bg-[#016564] text-white' : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
              className="rounded-xl border border-surface-border bg-white px-4 py-2.5 text-sm"
            >
              <option value="ALL">كل الأنواع</option>
              <option value="MAINTENANCE">الصيانة</option>
              <option value="CLEANING">النظافة</option>
              <option value="PURCHASE">الشراء المباشر</option>
              <option value="OTHER">طلبات أخرى</option>
            </select>

            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالعنوان أو المادة أو الجهة أو الوصف"
              className="rounded-xl border border-surface-border bg-white px-4 py-2.5 text-sm outline-none md:min-w-[320px]"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <Card className="rounded-[28px] border border-dashed border-slate-200 p-10 text-center text-slate-500">
            لا توجد طلبات مطابقة
          </Card>
        ) : (
          filteredItems.map((item) => {
            const meta = parseMeta(item.justification);
            const adminMeta = parseMeta(item.adminNotes);

            return (
              <Card key={item.id} className="rounded-[28px] border border-surface-border p-5 shadow-soft">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {categoryBadge(item.category)}
                      {priorityBadge(item.priority)}
                      {statusBadge(item.status)}
                    </div>

                    <h2 className="mt-3 text-[20px] leading-8 text-slate-900">{item.title}</h2>
                    <p className="mt-2 text-[14px] leading-8 text-slate-600">{item.description}</p>

                    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                      <div>
                        <div className="text-[11px] text-slate-500">المادة / العنصر</div>
                        <div className="mt-1 text-[14px] text-slate-900">{meta.itemName || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">الكمية</div>
                        <div className="mt-1 text-[14px] text-slate-900">{meta.quantity || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">الموقع</div>
                        <div className="mt-1 text-[14px] text-slate-900">{meta.location || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">صاحب الطلب</div>
                        <div className="mt-1 text-[14px] text-slate-900">{item.requester?.fullName || '—'}</div>
                      </div>
                      <div>
                        <div className="text-[11px] text-slate-500">الإدارة</div>
                        <div className="mt-1 text-[14px] text-slate-900">{item.requester?.department || '—'}</div>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-[13px] leading-7 text-slate-700">
                      <div className="mb-1 font-semibold text-slate-900">المبررات</div>
                      {meta.rawJustification || item.justification}
                    </div>

                    {item.status === 'IMPLEMENTED' ? (
                      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-[13px] leading-7 text-emerald-800">
                        تم تحويل الطلب إلى: {adminMeta.linkedEntityType || '—'} / {adminMeta.linkedCode || '—'}
                      </div>
                    ) : null}

                    {item.status === 'REJECTED' && item.adminNotes ? (
                      <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-[13px] leading-7 text-rose-800">
                        سبب الرفض: {item.adminNotes}
                      </div>
                    ) : null}

                    <div className="mt-3 text-[12px] text-slate-500">{formatDate(item.createdAt)}</div>
                  </div>

                  {isManager && item.status === 'PENDING' ? (
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setSelectedItem(item);
                          setAdminNotes('');
                          setEstimatedValue('');
                          setTargetDepartment(
                            item.category === 'PURCHASE'
                              ? 'PROCUREMENT'
                              : item.category === 'MAINTENANCE'
                              ? 'FACILITIES'
                              : item.category === 'CLEANING'
                              ? 'SUPPORT_SERVICES'
                              : 'SUPPORT_SERVICES'
                          );
                        }}
                      >
                        مراجعة وتحويل
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })
        )}
      </div>

      <Modal isOpen={isModalOpen} onClose={closeCreateModal} title="طلب جديد">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input label="عنوان الطلب" value={title} onChange={(e) => setTitle(e.target.value)} required />

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">نوع الطلب</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as SuggestionCategory)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="MAINTENANCE">طلب صيانة</option>
              <option value="CLEANING">طلب نظافة</option>
              <option value="PURCHASE">طلب شراء مباشر</option>
              <option value="OTHER">طلب آخر</option>
            </select>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="المادة / العنصر" value={itemName} onChange={(e) => setItemName(e.target.value)} />
            <Input label="الكمية" type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Input label="الموقع / الجهة المستفيدة" value={location} onChange={(e) => setLocation(e.target.value)} />
            <div>
              <label className="mb-2 block text-sm font-medium text-primary">الأولوية</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full rounded-xl border border-surface-border bg-white p-3"
              >
                <option value="LOW">منخفضة</option>
                <option value="NORMAL">عادية</option>
                <option value="HIGH">عالية</option>
                <option value="URGENT">عاجلة</option>
              </select>
            </div>
          </div>

          <Input
            label="الجهة الخارجية المقترحة (اختياري)"
            value={externalRecipient}
            onChange={(e) => setExternalRecipient(e.target.value)}
          />

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">الإدارة المستهدفة</label>
            <select
              value={targetDepartment}
              onChange={(e) => setTargetDepartment(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="SUPPORT_SERVICES">الخدمات المساندة</option>
              <option value="IT">تقنية المعلومات</option>
              <option value="FINANCE">الإدارة المالية</option>
              <option value="PROCUREMENT">المشتريات</option>
              <option value="FACILITIES">التشغيل والمرافق</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">الوصف</label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">المبررات</label>
            <textarea
              rows={4}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              required
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={closeCreateModal}>
              إلغاء
            </Button>
            <Button type="submit">إرسال الطلب</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        title="مراجعة المدير وتحويل الطلب"
      >
        <div className="space-y-4">
          {selectedItem ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-[13px] leading-7 text-slate-700">
              <div><span className="font-semibold text-slate-900">النوع:</span> {categoryLabel(selectedItem.category)}</div>
              <div><span className="font-semibold text-slate-900">العنوان:</span> {selectedItem.title}</div>
              <div><span className="font-semibold text-slate-900">صاحب الطلب:</span> {selectedItem.requester?.fullName || '—'}</div>
            </div>
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">ملاحظات المدير</label>
            <textarea
              rows={4}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
          </div>

          {selectedItem?.category === 'PURCHASE' ? (
            <Input
              label="القيمة التقديرية (اختياري)"
              type="number"
              value={estimatedValue}
              onChange={(e) => setEstimatedValue(e.target.value)}
            />
          ) : null}

          <div>
            <label className="mb-2 block text-sm font-medium text-primary">الإدارة / الجهة المستهدفة</label>
            <select
              value={targetDepartment}
              onChange={(e) => setTargetDepartment(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="SUPPORT_SERVICES">الخدمات المساندة</option>
              <option value="IT">تقنية المعلومات</option>
              <option value="FINANCE">الإدارة المالية</option>
              <option value="PROCUREMENT">المشتريات</option>
              <option value="FACILITIES">التشغيل والمرافق</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="danger" onClick={() => handleManagerAction('reject')}>
              رفض
            </Button>
            <Button onClick={() => handleManagerAction('approve')}>
              اعتماد وتحويل
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}