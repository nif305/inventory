'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';

type InventoryItem = {
  id: string;
  code?: string;
  name: string;
  category?: string | null;
  subcategory?: string | null;
  availableQty: number;
  quantity: number;
  unit?: string | null;
  status?: string;
  type?: 'RETURNABLE' | 'CONSUMABLE';
};

type RequestItemRow = {
  id: string;
  itemId: string;
  quantity: number;
  notes?: string | null;
  expectedReturnDate?: string | null;
  activeIssuedQty?: number;
  item?: {
    id?: string;
    name?: string;
    code?: string;
    availableQty?: number;
    unit?: string | null;
    type?: 'RETURNABLE' | 'CONSUMABLE';
  };
};

type RequestRow = {
  id: string;
  requesterId?: string;
  code: string;
  purpose: string;
  notes?: string | null;
  status: 'PENDING' | 'REJECTED' | 'ISSUED' | 'RETURNED' | 'DRAFT';
  createdAt: string;
  rejectionReason?: string | null;
  requester?: {
    id?: string;
    fullName?: string;
    department?: string;
    email?: string;
  };
  items?: RequestItemRow[];
};

type SelectedItem = {
  itemId: string;
  quantity: number;
  expectedReturnDate?: string;
};

type FormMode = 'create' | 'edit' | 'adjust';
type WarehouseViewMode = 'new' | 'finished' | 'returns';

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  PENDING: { label: 'جديد', variant: 'warning' },
  REJECTED: { label: 'ملغي / مرفوض', variant: 'danger' },
  ISSUED: { label: 'تم الصرف', variant: 'success' },
  RETURNED: { label: 'تمت الإعادة', variant: 'neutral' },
  DRAFT: { label: 'مسودة', variant: 'neutral' },
};

function formatDate(date?: string | null) {
  if (!date) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(date));
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

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold text-slate-700">{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
      />
    </div>
  );
}

function RequestItemsPreview({
  items,
  requestCode,
}: {
  items: RequestItemRow[];
  requestCode: string;
}) {
  const [open, setOpen] = useState(false);

  if (!items?.length) {
    return <span className="text-sm text-[#61706f]">—</span>;
  }

  const totalQty = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-fit items-center gap-2 rounded-full border border-[#d6d7d4] bg-[#f8f9f9] px-3 py-2 text-sm font-bold text-[#016564] transition hover:bg-[#eef6f5]"
        >
          <span>عرض المواد</span>
          <span className="rounded-full bg-[#016564] px-2 py-0.5 text-xs text-white">
            {items.length}
          </span>
        </button>

        <div className="text-xs text-[#61706f]">إجمالي الكمية: {totalQty}</div>
      </div>

      <Modal isOpen={open} onClose={() => setOpen(false)} title={`مواد الطلب ${requestCode}`}>
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-[#e8ecec] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-bold text-[#152625]">
                    {item.item?.name || 'مادة'}
                  </div>
                  <div className="mt-1 text-xs text-[#61706f]">الكمية: {item.quantity}</div>
                  {item.expectedReturnDate ? (
                    <div className="mt-1 text-xs text-[#61706f]">
                      الإرجاع المتوقع: {formatDate(item.expectedReturnDate)}
                    </div>
                  ) : null}
                  {(item.activeIssuedQty || 0) > 0 ? (
                    <div className="mt-1 text-xs text-[#016564]">
                      المتبقي غير المعاد: {item.activeIssuedQty}
                    </div>
                  ) : null}
                </div>

                <Badge variant={item.item?.type === 'RETURNABLE' ? 'info' : 'neutral'}>
                  {item.item?.type === 'RETURNABLE' ? 'مسترجعة' : 'استهلاكية'}
                </Badge>
              </div>
            </div>
          ))}

          <div className="flex justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              إغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

function FormShell({
  isOpen,
  onClose,
  title,
  children,
  footer,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 px-2 py-2 sm:px-4 sm:py-6">
      <div className="mx-auto flex h-full items-center justify-center">
        <div className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden rounded-none border-0 bg-white shadow-2xl sm:h-auto sm:max-h-[92vh] sm:max-w-[1080px] sm:rounded-[28px] sm:border sm:border-[#d6d7d4]">
          <div className="flex items-center justify-between border-b border-[#eceeed] px-4 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-extrabold text-[#016564] sm:text-xl">{title}</h2>
              <p className="mt-1 text-[11px] text-[#6f7b7a] sm:text-xs">
                نموذج طلب بسيط، مباشر، وواضح للمستخدم.
              </p>
            </div>

            <Button type="button" variant="ghost" onClick={onClose}>
              إغلاق
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto bg-white px-4 py-4 sm:px-6 sm:py-5">{children}</div>

          <div className="border-t border-[#eceeed] bg-[#fcfcfc] px-4 py-4 sm:px-6">{footer}</div>
        </div>
      </div>
    </div>
  );
}

export default function RequestsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const isManager = user?.role === 'manager';
  const isWarehouse = user?.role === 'warehouse';
  const isEmployee = user?.role === 'user';
  const canIssue = isWarehouse || isManager;
  const canUseWarehouseTabs = isWarehouse || isManager;

  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formMode, setFormMode] = useState<FormMode>('create');
  const [activeRequest, setActiveRequest] = useState<RequestRow | null>(null);

  const [availableItems, setAvailableItems] = useState<InventoryItem[]>([]);
  const [inventoryLoading, setInventoryLoading] = useState(false);

  const [purpose, setPurpose] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [itemSearch, setItemSearch] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState('');
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedExpectedReturn, setSelectedExpectedReturn] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [warehouseViewMode, setWarehouseViewMode] = useState<WarehouseViewMode>('new');

  const sessionHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
    }),
    []
  );

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests', { cache: 'no-store' });
      const data = await res.json();
      setRequests(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchInventory = useCallback(async () => {
    setInventoryLoading(true);
    try {
      const res = await fetch('/api/inventory?limit=200', { cache: 'no-store' });
      const data = await res.json();
      setAvailableItems(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setAvailableItems([]);
    } finally {
      setInventoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isEmployee) {
      openCreateModal();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isEmployee]);

  useEffect(() => {
    if (isModalOpen) {
      fetchInventory();
    }
  }, [isModalOpen, fetchInventory]);

  const resetForm = useCallback(() => {
    setPurpose('');
    setNotes('');
    setSelectedItems([]);
    setSelectedInventoryId('');
    setSelectedQuantity(1);
    setSelectedExpectedReturn('');
    setItemSearch('');
    setActiveRequest(null);
    setFormMode('create');
  }, []);

  const handleCloseModal = useCallback(() => {
    setIsModalOpen(false);
    resetForm();
    if (searchParams.get('new') === '1') {
      router.replace('/requests');
    }
  }, [resetForm, router, searchParams]);

  const openCreateModal = () => {
    resetForm();
    setFormMode('create');
    setIsModalOpen(true);
  };

  const openEditModal = (requestRow: RequestRow) => {
    resetForm();
    setFormMode('edit');
    setActiveRequest(requestRow);
    setPurpose(requestRow.purpose || '');
    setNotes(requestRow.notes || '');
    setSelectedItems(
      (requestRow.items || []).map((item) => ({
        itemId: item.itemId,
        quantity: item.quantity,
        expectedReturnDate: item.expectedReturnDate || '',
      }))
    );
    setIsModalOpen(true);
  };

  const openAdjustModal = (requestRow: RequestRow) => {
    resetForm();
    setFormMode('adjust');
    setActiveRequest(requestRow);
    setSelectedItems(
      (requestRow.items || [])
        .filter((item) => (item.activeIssuedQty || 0) > 0)
        .map((item) => ({
          itemId: item.itemId,
          quantity: 0,
        }))
    );
    setIsModalOpen(true);
  };

  const stats = useMemo(() => {
    return {
      total: requests.length,
      pending: requests.filter((r) => r.status === 'PENDING').length,
      rejected: requests.filter((r) => r.status === 'REJECTED').length,
      issued: requests.filter((r) => r.status === 'ISSUED').length,
      returned: requests.filter((r) => r.status === 'RETURNED').length,
      warehouseNew: requests.filter((r) => r.status === 'PENDING').length,
      warehouseFinished: requests.filter(
        (r) => r.status === 'ISSUED' || r.status === 'RETURNED' || r.status === 'REJECTED'
      ).length,
      warehouseReturns: requests.filter((r) => r.status === 'RETURNED').length,
    };
  }, [requests]);

  const displayedRequests = useMemo(() => {
    if (!canUseWarehouseTabs) return requests;

    if (warehouseViewMode === 'new') {
      return requests.filter((r) => r.status === 'PENDING');
    }

    if (warehouseViewMode === 'finished') {
      return requests.filter(
        (r) => r.status === 'ISSUED' || r.status === 'RETURNED' || r.status === 'REJECTED'
      );
    }

    return requests.filter((r) => r.status === 'RETURNED');
  }, [requests, canUseWarehouseTabs, warehouseViewMode]);

  const filteredInventory = useMemo(() => {
    const q = normalizeArabic(itemSearch);
    const inventoryBase = availableItems.filter((item) => item.availableQty > 0);

    if (!q) return inventoryBase.slice(0, 20);

    return inventoryBase
      .filter((item) => {
        const haystack = normalizeArabic(
          [item.name, item.code, item.category, item.subcategory].filter(Boolean).join(' ')
        );
        return haystack.includes(q);
      })
      .slice(0, 20);
  }, [availableItems, itemSearch]);

  const selectedInventoryItem = useMemo(() => {
    return availableItems.find((item) => item.id === selectedInventoryId) || null;
  }, [availableItems, selectedInventoryId]);

  const resolveItem = (itemId: string) =>
    availableItems.find((item) => item.id === itemId) ||
    activeRequest?.items?.find((item) => item.itemId === itemId)?.item ||
    requests.flatMap((request) => request.items || []).find((item) => item.itemId === itemId)?.item;

  const addItemToForm = () => {
    if (!selectedInventoryId || selectedQuantity < 1) return;

    const inventoryItem = availableItems.find((item) => item.id === selectedInventoryId);
    if (!inventoryItem) return;

    const existing = selectedItems.find((item) => item.itemId === selectedInventoryId);
    const nextQty = (existing?.quantity || 0) + selectedQuantity;

    if (nextQty > inventoryItem.availableQty) {
      alert(`الكمية تتجاوز المتاح للصنف ${inventoryItem.name}`);
      return;
    }

    if (inventoryItem.type === 'RETURNABLE' && !selectedExpectedReturn) {
      alert('حدد تاريخ الإرجاع المتوقع للمادة المسترجعة');
      return;
    }

    if (existing) {
      setSelectedItems((prev) =>
        prev.map((item) =>
          item.itemId === selectedInventoryId
            ? {
                ...item,
                quantity: nextQty,
                expectedReturnDate:
                  inventoryItem.type === 'RETURNABLE'
                    ? selectedExpectedReturn || item.expectedReturnDate
                    : '',
              }
            : item
        )
      );
    } else {
      setSelectedItems((prev) => [
        ...prev,
        {
          itemId: selectedInventoryId,
          quantity: selectedQuantity,
          expectedReturnDate:
            inventoryItem.type === 'RETURNABLE' ? selectedExpectedReturn : '',
        },
      ]);
    }

    setSelectedInventoryId('');
    setSelectedQuantity(1);
    setSelectedExpectedReturn('');
    setItemSearch('');
  };

  const updateSelectedItemQty = (itemId: string, quantity: number) => {
    const safeQty = Math.max(0, Math.floor(quantity || 0));
    setSelectedItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, quantity: safeQty } : item))
    );
  };

  const updateSelectedItemExpectedReturn = (itemId: string, value: string) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.itemId === itemId ? { ...item, expectedReturnDate: value } : item))
    );
  };

  const removeSelectedItem = (itemId: string) => {
    setSelectedItems((prev) => prev.filter((item) => item.itemId !== itemId));
  };

  const handleIssueOrReject = async (
    id: string,
    action: 'issue' | 'reject',
    notesValue?: string
  ) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: sessionHeaders,
      body: JSON.stringify({
        action,
        notes: notesValue || '',
        reason: notesValue || '',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || 'تعذر تنفيذ العملية');
      return;
    }

    await fetchRequests();
  };

  const handleEmployeeCancel = async (id: string) => {
    const res = await fetch(`/api/requests/${id}`, {
      method: 'PATCH',
      headers: sessionHeaders,
      body: JSON.stringify({
        action: 'cancel',
        notes: 'تم الإلغاء من الموظف',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.error || 'تعذر إلغاء الطلب');
      return;
    }

    await fetchRequests();
  };

  const handleSubmit = async () => {
    const cleanedItems =
      formMode === 'adjust'
        ? selectedItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              itemId: item.itemId,
              quantityToReturn: item.quantity,
            }))
        : selectedItems
            .filter((item) => item.quantity > 0)
            .map((item) => ({
              itemId: item.itemId,
              quantity: item.quantity,
              expectedReturnDate: item.expectedReturnDate || null,
            }));

    if (formMode !== 'adjust' && !purpose.trim()) {
      alert('الغرض من الطلب مطلوب');
      return;
    }

    if (cleanedItems.length === 0) {
      alert('أضف مادة واحدة على الأقل');
      return;
    }

    const invalidReturnable = selectedItems.some((row) => {
      const item = resolveItem(row.itemId) as InventoryItem | undefined;
      return item?.type === 'RETURNABLE' && !row.expectedReturnDate && formMode !== 'adjust';
    });

    if (invalidReturnable) {
      alert('يوجد صنف مسترجع بدون تاريخ إرجاع متوقع');
      return;
    }

    setSubmitting(true);
    try {
      let res: Response;

      if (formMode === 'create') {
        res = await fetch('/api/requests', {
          method: 'POST',
          headers: sessionHeaders,
          body: JSON.stringify({
            purpose,
            notes,
            items: cleanedItems,
          }),
        });
      } else if (formMode === 'edit' && activeRequest) {
        res = await fetch(`/api/requests/${activeRequest.id}`, {
          method: 'PATCH',
          headers: sessionHeaders,
          body: JSON.stringify({
            action: 'update',
            purpose,
            notes,
            items: cleanedItems,
          }),
        });
      } else if (formMode === 'adjust' && activeRequest) {
        res = await fetch(`/api/requests/${activeRequest.id}`, {
          method: 'PATCH',
          headers: sessionHeaders,
          body: JSON.stringify({
            action: 'adjust_after_issue',
            notes,
            items: cleanedItems,
          }),
        });
      } else {
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        alert(data?.error || 'تعذر حفظ العملية');
        return;
      }

      handleCloseModal();
      await fetchRequests();
    } finally {
      setSubmitting(false);
    }
  };

  const modalTitle =
    formMode === 'create'
      ? 'طلب مواد جديد'
      : formMode === 'edit'
      ? 'تعديل الطلب قبل الصرف'
      : 'طلب إرجاع فائض';

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d6d7d4] bg-white px-5 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-[#016564]">
              {isEmployee ? 'طلب مواد' : 'الطلبات التشغيلية'}
            </h1>
            <p className="text-sm text-[#61706f]">
              {isEmployee
                ? 'رفع الطلبات وتعديلها قبل الصرف وطلب إرجاع الفائض بعد الصرف.'
                : 'تنفيذ الصرف مباشرة ومتابعة الطلبات من مكان واحد دون دورة اعتماد.'}
            </p>
          </div>

          {isEmployee ? <Button onClick={openCreateModal}>طلب جديد</Button> : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">{canUseWarehouseTabs ? 'طلبات جديدة' : 'الإجمالي'}</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">
              {canUseWarehouseTabs ? stats.warehouseNew : stats.total}
            </div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">
              {canUseWarehouseTabs ? 'طلبات منتهية' : 'جديدة'}
            </div>
            <div className="mt-1 text-xl font-extrabold text-[#d0b284]">
              {canUseWarehouseTabs ? stats.warehouseFinished : stats.pending}
            </div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">
              {canUseWarehouseTabs ? 'طلبات أُعيدت' : 'تمت الإعادة'}
            </div>
            <div className="mt-1 text-xl font-extrabold text-[#498983]">
              {canUseWarehouseTabs ? stats.warehouseReturns : stats.returned}
            </div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">تم الصرف</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">{stats.issued}</div>
          </Card>

          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">الملغاة / المرفوضة</div>
            <div className="mt-1 text-xl font-extrabold text-[#7c1e3e]">{stats.rejected}</div>
          </Card>
        </div>
      </section>

      {canUseWarehouseTabs ? (
        <section className="flex flex-wrap gap-2">
          <Button
            variant={warehouseViewMode === 'new' ? 'primary' : 'secondary'}
            onClick={() => setWarehouseViewMode('new')}
          >
            الطلبات الجديدة
          </Button>
          <Button
            variant={warehouseViewMode === 'finished' ? 'primary' : 'secondary'}
            onClick={() => setWarehouseViewMode('finished')}
          >
            الطلبات المنتهية
          </Button>
          <Button
            variant={warehouseViewMode === 'returns' ? 'primary' : 'secondary'}
            onClick={() => setWarehouseViewMode('returns')}
          >
            الطلبات المعادة
          </Button>
        </section>
      ) : null}

      <Card className="overflow-hidden rounded-[28px] border border-[#d6d7d4] shadow-sm">
        {loading ? (
          <div className="space-y-4 p-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : displayedRequests.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#6f7b7a]">لا توجد طلبات حتى الآن</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-right">
              <thead className="border-b bg-[#f8f9f9]">
                <tr className="text-sm text-[#016564]">
                  <th className="p-4 font-bold">رقم الطلب</th>
                  {!isEmployee ? <th className="p-4 font-bold">مقدم الطلب</th> : null}
                  <th className="p-4 font-bold">الغرض</th>
                  <th className="p-4 font-bold">المواد المطلوبة</th>
                  <th className="p-4 font-bold">الحالة</th>
                  <th className="p-4 font-bold">تاريخ الطلب</th>
                  <th className="p-4 font-bold">الإجراءات</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#eef1f1]">
                {displayedRequests.map((req) => {
                  const statusMeta = STATUS_MAP[req.status] || {
                    label: req.status,
                    variant: 'neutral' as const,
                  };

                  return (
                    <tr key={req.id} className="align-middle hover:bg-[#f8f9f9]">
                      <td className="p-4 font-mono text-sm font-bold text-[#016564]">{req.code}</td>

                      {!isEmployee ? (
                        <td className="p-4 text-sm text-[#304342]">
                          <div>{req.requester?.fullName || '—'}</div>
                          <div className="mt-1 text-xs text-[#6f7b7a]">
                            {req.requester?.department || ''}
                          </div>
                        </td>
                      ) : null}

                      <td className="p-4">
                        <div className="max-w-[260px] text-sm font-semibold text-[#152625]">
                          {req.purpose}
                        </div>
                        {req.notes ? <div className="mt-1 text-xs text-[#61706f]">{req.notes}</div> : null}
                        {req.rejectionReason ? (
                          <div className="mt-1 text-xs text-[#7c1e3e]">
                            سبب الإلغاء / الرفض: {req.rejectionReason}
                          </div>
                        ) : null}
                      </td>

                      <td className="p-4">
                        <RequestItemsPreview items={req.items || []} requestCode={req.code} />
                      </td>

                      <td className="p-4">
                        <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                      </td>

                      <td className="p-4 text-sm text-[#61706f]">{formatDate(req.createdAt)}</td>

                      <td className="p-4">
                        <div className="flex flex-wrap gap-2">
                          {canIssue && req.status === 'PENDING' ? (
                            <>
                              <Button size="sm" onClick={() => handleIssueOrReject(req.id, 'issue')}>
                                صرف المواد
                              </Button>
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleIssueOrReject(req.id, 'reject', 'تم رفض الطلب')}
                              >
                                رفض
                              </Button>
                            </>
                          ) : null}

                          {isEmployee && req.status === 'PENDING' ? (
                            <>
                              <Button size="sm" onClick={() => openEditModal(req)}>
                                تعديل
                              </Button>
                              <Button size="sm" variant="danger" onClick={() => handleEmployeeCancel(req.id)}>
                                إلغاء
                              </Button>
                            </>
                          ) : null}

                          {isEmployee && req.status === 'ISSUED' ? (
                            <Button size="sm" variant="secondary" onClick={() => openAdjustModal(req)}>
                              إرجاع فائض
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <FormShell
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={modalTitle}
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
            <Button type="button" variant="ghost" onClick={handleCloseModal} className="w-full sm:w-auto">
              إغلاق
            </Button>
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || selectedItems.length === 0}
              className="w-full sm:w-auto"
            >
              {submitting
                ? 'جاري الحفظ...'
                : formMode === 'create'
                ? 'حفظ الطلب'
                : formMode === 'edit'
                ? 'حفظ التعديل'
                : 'رفع طلب الإرجاع'}
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {formMode !== 'adjust' ? (
            <>
              <section className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
                <div className="text-sm font-bold text-[#016564]">بيانات الطلب</div>
                <div className="mt-4">
                  <Input
                    label="الغرض من الطلب"
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value)}
                    placeholder="مثال: تجهيز دورة تدريبية أو فعالية"
                  />
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                  <div className="mb-4 text-sm font-bold text-[#016564]">استعراض المواد</div>

                  <div className="space-y-4">
                    <Input
                      label="ابحث عن المادة"
                      value={itemSearch}
                      onChange={(e) => setItemSearch(e.target.value)}
                      placeholder="اسم المادة أو الكود"
                    />

                    <div className="overflow-hidden rounded-2xl border border-[#e7ebea]">
                      <div className="hidden grid-cols-[minmax(0,1.4fr)_110px_110px] gap-3 border-b bg-[#f8f9f9] px-4 py-3 text-xs font-bold text-[#016564] sm:grid">
                        <div>المادة</div>
                        <div>المتاح</div>
                        <div>النوع</div>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto bg-white">
                        {inventoryLoading ? (
                          <div className="px-4 py-4 text-sm text-[#61706f]">جاري تحميل المواد...</div>
                        ) : filteredInventory.length === 0 ? (
                          <div className="px-4 py-4 text-sm text-[#61706f]">لا توجد نتائج</div>
                        ) : (
                          filteredInventory.map((item) => {
                            const isSelected = selectedInventoryId === item.id;

                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => {
                                  setSelectedInventoryId(item.id);
                                  setSelectedQuantity(1);
                                  setSelectedExpectedReturn('');
                                }}
                                className={`w-full border-b border-[#eef1f1] px-4 py-3 text-right transition last:border-b-0 ${
                                  isSelected ? 'bg-[#eef6f5]' : 'bg-white hover:bg-[#fafcfc]'
                                }`}
                              >
                                <div className="grid gap-2 sm:grid-cols-[minmax(0,1.4fr)_110px_110px] sm:gap-3">
                                  <div className="min-w-0">
                                    <div className="truncate text-sm font-semibold text-[#152625]">
                                      {item.name}
                                    </div>
                                    <div className="mt-1 text-xs text-[#61706f]">
                                      {item.code ? item.code : '—'}
                                    </div>
                                  </div>

                                  <div className="text-sm text-[#304342] sm:self-center">
                                    {item.availableQty}
                                    {item.unit ? ` ${item.unit}` : ''}
                                  </div>

                                  <div className="sm:self-center">
                                    <Badge variant={item.type === 'RETURNABLE' ? 'info' : 'neutral'}>
                                      {item.type === 'RETURNABLE' ? 'مسترجعة' : 'استهلاكية'}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                  <div className="mb-4 text-sm font-bold text-[#016564]">المواد المختارة</div>

                  <div className="space-y-4">
                    {selectedInventoryItem ? (
                      <div className="rounded-2xl border border-[#e7ebea] bg-[#f8f9f9] p-4">
                        <div className="mb-3 text-sm font-semibold text-[#152625]">
                          {selectedInventoryItem.name}
                        </div>

                        <div className="grid gap-4 md:grid-cols-3">
                          <Input
                            label="الكمية"
                            type="number"
                            min={1}
                            max={selectedInventoryItem.availableQty || undefined}
                            value={selectedQuantity}
                            onChange={(e) => setSelectedQuantity(Number(e.target.value || 1))}
                          />

                          {selectedInventoryItem.type === 'RETURNABLE' ? (
                            <Input
                              label="تاريخ الإرجاع المتوقع"
                              type="date"
                              value={selectedExpectedReturn}
                              onChange={(e) => setSelectedExpectedReturn(e.target.value)}
                            />
                          ) : (
                            <div className="flex items-end">
                              <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-white px-4 py-3 text-sm text-[#61706f]">
                                مادة استهلاكية
                              </div>
                            </div>
                          )}

                          <div className="flex items-end">
                            <Button type="button" onClick={addItemToForm} className="w-full">
                              إضافة
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-4 py-5 text-sm text-[#61706f]">
                        اختر مادة من قائمة الاستعراض ليتم إضافتها هنا.
                      </div>
                    )}

                    {selectedItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
                        لا توجد مواد مضافة
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedItems.map((item) => {
                          const itemInfo = resolveItem(item.itemId) as
                            | InventoryItem
                            | RequestItemRow['item']
                            | undefined;
                          const isReturnable = itemInfo?.type === 'RETURNABLE';

                          return (
                            <div
                              key={item.itemId}
                              className="rounded-2xl border border-[#e7ebea] bg-white p-4"
                            >
                              <div className="mb-3">
                                <div className="text-sm font-semibold text-[#152625]">
                                  {itemInfo?.name || 'مادة'}
                                </div>
                                <div className="mt-1 text-xs text-[#61706f]">
                                  {isReturnable ? 'مسترجعة' : 'استهلاكية'}
                                </div>
                              </div>

                              <div className="grid gap-3 sm:grid-cols-3">
                                <Input
                                  label="الكمية"
                                  type="number"
                                  min={1}
                                  max={(itemInfo as InventoryItem)?.availableQty || undefined}
                                  value={item.quantity}
                                  onChange={(e) =>
                                    updateSelectedItemQty(item.itemId, Number(e.target.value || 0))
                                  }
                                />

                                {isReturnable ? (
                                  <Input
                                    label="تاريخ الإرجاع"
                                    type="date"
                                    value={item.expectedReturnDate || ''}
                                    onChange={(e) =>
                                      updateSelectedItemExpectedReturn(item.itemId, e.target.value)
                                    }
                                  />
                                ) : (
                                  <div className="flex items-end">
                                    <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-3 py-3 text-center text-xs text-[#61706f]">
                                      لا ينطبق
                                    </div>
                                  </div>
                                )}

                                <div className="flex items-end">
                                  <Button
                                    type="button"
                                    variant="danger"
                                    className="w-full"
                                    onClick={() => removeSelectedItem(item.itemId)}
                                  >
                                    حذف
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-[#e7ebea] bg-white p-4 sm:p-5">
                <TextArea
                  label="ملاحظات عامة"
                  value={notes}
                  onChange={setNotes}
                  placeholder="ملاحظات إضافية"
                  rows={3}
                />
              </section>
            </>
          ) : (
            <>
              <section className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
                <div className="mb-4 text-sm font-bold text-[#016564]">بيانات الإرجاع</div>

                <div className="space-y-4">
                  <div className="rounded-2xl border border-[#e7ebea] bg-white px-4 py-3 text-sm text-[#304342]">
                    <div>
                      <span className="font-semibold text-[#016564]">الطلب:</span>{' '}
                      {activeRequest?.code || '—'}
                    </div>
                    <div className="mt-1">
                      <span className="font-semibold text-[#016564]">الغرض:</span>{' '}
                      {activeRequest?.purpose || '—'}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {selectedItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-[#d6d7d4] px-4 py-8 text-center text-sm text-[#61706f]">
                        لا توجد عناصر قابلة للإرجاع
                      </div>
                    ) : (
                      selectedItems.map((item) => {
                        const itemInfo = resolveItem(item.itemId) as
                          | InventoryItem
                          | RequestItemRow['item']
                          | undefined;
                        const activeIssued =
                          activeRequest?.items?.find((row) => row.itemId === item.itemId)
                            ?.activeIssuedQty || 0;

                        return (
                          <div
                            key={item.itemId}
                            className="rounded-2xl border border-[#e7ebea] bg-white p-4"
                          >
                            <div className="mb-3">
                              <div className="text-sm font-semibold text-[#152625]">
                                {itemInfo?.name || 'مادة'}
                              </div>
                              <div className="mt-1 text-xs text-[#61706f]">
                                المصروف غير المعاد: {activeIssued}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input
                                label="كمية الإرجاع"
                                type="number"
                                min={0}
                                max={activeIssued}
                                value={item.quantity}
                                onChange={(e) =>
                                  updateSelectedItemQty(item.itemId, Number(e.target.value || 0))
                                }
                              />

                              <div className="flex items-end">
                                <div className="w-full rounded-2xl border border-dashed border-[#d6d7d4] bg-[#fcfcfc] px-3 py-3 text-center text-xs text-[#61706f]">
                                  سيتم استلام وتوثيق حالة المادة لاحقًا
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  <TextArea
                    label="ملاحظات الإرجاع"
                    value={notes}
                    onChange={setNotes}
                    placeholder="مثال: تم إرجاع الفائض بعد انتهاء البرنامج"
                    rows={3}
                  />
                </div>
              </section>
            </>
          )}
        </div>
      </FormShell>
    </div>
  );
}