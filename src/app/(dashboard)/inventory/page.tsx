'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Skeleton } from '@/components/ui/Skeleton';
import { syncInventoryAlerts } from '@/lib/notifications';

type InventoryItem = {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  category: string;
  subcategory?: string | null;
  type: 'RETURNABLE' | 'CONSUMABLE';
  quantity: number;
  availableQty: number;
  reservedQty: number;
  minStock: number;
  unit: string;
  location: string | null;
  status: 'AVAILABLE' | 'LOW_STOCK' | 'OUT_OF_STOCK';
  unitPrice?: number | null;
  totalPrice?: number | null;
  financialTracking?: boolean;
  notes?: string | null;
};

type InventoryApiResponse = {
  data: InventoryItem[];
  categories?: string[];
  stats?: {
    totalItems: number;
    totalUnits: number;
    lowStockCount: number;
    outOfStockCount: number;
    totalEstimatedValue: number;
    returnableCount: number;
    consumableCount: number;
    availableCount: number;
    usedCount: number;
  };
  pagination?: {
    page: number;
    total: number;
    totalPages: number;
    limit: number;
  };
};

const emptyStats = {
  totalItems: 0,
  totalUnits: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  totalEstimatedValue: 0,
  returnableCount: 0,
  consumableCount: 0,
  availableCount: 0,
  usedCount: 0,
};

const defaultForm = {
  code: '',
  name: '',
  category: '',
  type: 'RETURNABLE' as 'RETURNABLE' | 'CONSUMABLE',
  quantity: '0',
  unitPrice: '',
};

const inventoryCategorySuggestions = [
  'معدات التدريب الأمني والدفاعي',
  'الإسعافات الأولية والسلامة',
  'الواقع الافتراضي والتصوير والمحاكاة',
  'الأجهزة التقنية والحاسب',
  'التجهيزات التدريبية والقاعة',
  'الأدوات الرياضية والتدريب البدني',
  'القرطاسية والمواد المكتبية',
  'الهويات والشهادات والمطبوعات',
];

const categoryPrefixMap: Record<string, string> = {
  'معدات التدريب الأمني والدفاعي': 'SEC',
  'الإسعافات الأولية والسلامة': 'MED',
  'الواقع الافتراضي والتصوير والمحاكاة': 'VR',
  'الأجهزة التقنية والحاسب': 'TEC',
  'التجهيزات التدريبية والقاعة': 'TRN',
  'الأدوات الرياضية والتدريب البدني': 'SPT',
  'القرطاسية والمواد المكتبية': 'STA',
  'الهويات والشهادات والمطبوعات': 'IDN',
};

const formatNumber = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('ar-SA').format(value);
};

const formatCurrency = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-';
  return new Intl.NumberFormat('ar-SA', {
    style: 'currency',
    currency: 'SAR',
    maximumFractionDigits: 2,
  }).format(value);
};

const extractNumericCode = (code: string) => {
  const match = code.match(/(\d+)/);
  return match ? match[1].padStart(3, '0') : '000';
};

const getDisplayCode = (item: InventoryItem) => {
  const categoryPrefix = categoryPrefixMap[item.category] || 'GEN';
  const typePrefix = item.type === 'RETURNABLE' ? 'R' : 'C';
  return `${categoryPrefix}-${typePrefix}-${extractNumericCode(item.code)}`;
};

const getTypeLabel = (type: 'RETURNABLE' | 'CONSUMABLE') =>
  type === 'RETURNABLE' ? 'مسترجعة' : 'مستهلكة';

const getGeneratedCodePreview = (
  category: string,
  type: 'RETURNABLE' | 'CONSUMABLE',
  existingCode?: string,
) => {
  const categoryPrefix = categoryPrefixMap[category] || 'GEN';
  const typePrefix = type === 'RETURNABLE' ? 'R' : 'C';
  const numericPart = existingCode ? extractNumericCode(existingCode) : 'AUTO';
  return `${categoryPrefix}-${typePrefix}-${numericPart}`;
};

const statCardClass =
  'surface-card-strong cursor-pointer rounded-[22px] p-4 transition duration-200 hover:-translate-y-1 hover:shadow-lg sm:rounded-[24px] sm:p-5';

export default function InventoryPage() {
  const { user } = useAuth();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');

  const [categories, setCategories] = useState<string[]>([]);
  const [stats, setStats] = useState(emptyStats);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  const [pagination, setPagination] = useState({
    page: 1,
    totalPages: 1,
    total: 0,
    limit: 12,
  });

  const [formState, setFormState] = useState(defaultForm);

  const canModify =
    user?.role === 'manager' ||
    user?.role === 'warehouse' ||
    user?.role === 'MANAGER' ||
    user?.role === 'WAREHOUSE';

  const fetchInventory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit),
      });

      if (search) params.set('search', search);
      if (statusFilter) params.set('status', statusFilter);
      if (typeFilter) params.set('type', typeFilter);

      const response = await fetch(`/api/inventory?${params.toString()}`, {
        cache: 'no-store',
      });

      const data: InventoryApiResponse = await response.json();

      const rows = Array.isArray(data.data) ? data.data : [];
      setItems(rows);
      setCategories(data.categories || []);
      setStats(data.stats || emptyStats);

      setPagination((prev) => ({
        ...prev,
        totalPages: data.pagination?.totalPages || 1,
        total: data.pagination?.total || rows.length,
      }));
    } catch {
      setItems([]);
      setStats(emptyStats);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, search, statusFilter, typeFilter]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  useEffect(() => {
    if (!items.length) return;
    syncInventoryAlerts(items);
  }, [items]);

  const mergedCategories = useMemo(
    () => [...new Set([...inventoryCategorySuggestions, ...categories])],
    [categories],
  );

  const estimatedLineValue = useMemo(() => {
    const quantity = Number(formState.quantity || 0);
    const unitPrice = Number(formState.unitPrice || 0);
    if (!formState.unitPrice) return null;
    return quantity * unitPrice;
  }, [formState.quantity, formState.unitPrice]);

  const generatedCodePreview = useMemo(
    () =>
      getGeneratedCodePreview(
        formState.category,
        formState.type,
        selectedItem ? selectedItem.code : undefined,
      ),
    [formState.category, formState.type, selectedItem],
  );

  const getStatusBadge = (status: InventoryItem['status']) => {
    if (status === 'LOW_STOCK') return <Badge variant="warning">منخفض لكنه متاح</Badge>;
    if (status === 'OUT_OF_STOCK') return <Badge variant="danger">نافد</Badge>;
    return <Badge variant="success">متاح</Badge>;
  };

  const openCreateModal = () => {
    setSelectedItem(null);
    setFormState(defaultForm);
    setIsModalOpen(true);
  };

  const openEditModal = (item: InventoryItem) => {
    setSelectedItem(item);
    setFormState({
      code: item.code || '',
      name: item.name || '',
      category: item.category || '',
      type: item.type || 'RETURNABLE',
      quantity: String(item.quantity ?? 0),
      unitPrice:
        item.unitPrice === null || item.unitPrice === undefined ? '' : String(item.unitPrice),
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedItem(null);
    setFormState(defaultForm);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm('هل أنت متأكد من حذف هذا الصنف؟');
    if (!confirmed) return;

    const response = await fetch(`/api/inventory/${id}`, {
      method: 'DELETE',
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      alert(data?.error || 'تعذر حذف الصنف');
      return;
    }

    await fetchInventory();
  };

  const handleFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);

    try {
      const payload = {
        code: selectedItem ? formState.code : undefined,
        name: formState.name,
        category: formState.category,
        type: formState.type,
        quantity: Number(formState.quantity || 0),
        unitPrice: formState.unitPrice === '' ? null : Number(formState.unitPrice),
        financialTracking: formState.unitPrice !== '',
      };

      const response = await fetch(
        selectedItem ? `/api/inventory/${selectedItem.id}` : '/api/inventory',
        {
          method: selectedItem ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        alert(data?.error || 'تعذر حفظ الصنف');
        return;
      }

      closeModal();
      await fetchInventory();
    } finally {
      setSaving(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setTypeFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const applyStatusFilter = (value: string) => {
    setStatusFilter(value);
    setTypeFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  const applyTypeFilter = (value: string) => {
    setTypeFilter(value);
    setStatusFilter('');
    setPagination((prev) => ({ ...prev, page: 1 }));
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="w-full lg:max-w-xl">
          <Input
            placeholder="ابحث بالاسم أو الرمز أو الفئة"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPagination((prev) => ({ ...prev, page: 1 }));
            }}
          />
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:justify-end">
          {canModify ? (
            <Button
              className="w-full bg-[#016564] text-white hover:bg-[#014b4a] sm:w-auto"
              onClick={openCreateModal}
            >
              إضافة مادة
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 sm:gap-4">
        <Card className={statCardClass} onClick={() => clearFilters()}>
          <p className="text-sm font-semibold text-surface-subtle">إجمالي المواد</p>
          <p className="mt-3 text-2xl font-extrabold text-primary sm:text-3xl">
            {formatNumber(stats.totalItems)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => applyStatusFilter('AVAILABLE')}>
          <p className="text-sm font-semibold text-surface-subtle">إجمالي المواد المتاحة</p>
          <p className="mt-3 text-2xl font-extrabold text-green-600 sm:text-3xl">
            {formatNumber(stats.availableCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => applyTypeFilter('CONSUMABLE')}>
          <p className="text-sm font-semibold text-surface-subtle">المواد المستهلكة</p>
          <p className="mt-3 text-2xl font-extrabold text-amber-700 sm:text-3xl">
            {formatNumber(stats.consumableCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => applyTypeFilter('RETURNABLE')}>
          <p className="text-sm font-semibold text-surface-subtle">المواد المسترجعة</p>
          <p className="mt-3 text-2xl font-extrabold text-emerald-700 sm:text-3xl">
            {formatNumber(stats.returnableCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => applyStatusFilter('LOW_STOCK')}>
          <p className="text-sm font-semibold text-surface-subtle">مواد منخفضة المخزون</p>
          <p className="mt-3 text-2xl font-extrabold text-orange-600 sm:text-3xl">
            {formatNumber(stats.lowStockCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => applyStatusFilter('OUT_OF_STOCK')}>
          <p className="text-sm font-semibold text-surface-subtle">مواد نافدة</p>
          <p className="mt-3 text-2xl font-extrabold text-red-600 sm:text-3xl">
            {formatNumber(stats.outOfStockCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => clearFilters()}>
          <p className="text-sm font-semibold text-surface-subtle">مواد مستخدمة جزئيًا</p>
          <p className="mt-3 text-2xl font-extrabold text-sky-700 sm:text-3xl">
            {formatNumber(stats.usedCount)}
          </p>
        </Card>

        <Card className={statCardClass} onClick={() => clearFilters()}>
          <p className="text-sm font-semibold text-surface-subtle">القيمة التقديرية</p>
          <p className="mt-3 text-xl font-extrabold text-primary sm:text-2xl">
            {formatCurrency(stats.totalEstimatedValue)}
          </p>
        </Card>
      </div>

      <Card className="surface-card-strong overflow-hidden rounded-[22px] sm:rounded-[28px]">
        {loading ? (
          <div className="space-y-3 p-4 sm:space-y-4">
            {[1, 2, 3, 4, 5, 6].map((value) => (
              <Skeleton key={value} className="h-14 w-full" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm font-medium text-slate-500 sm:p-10">
            لا توجد مواد مطابقة
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 sm:hidden">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[20px] border border-slate-200 bg-white p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-extrabold text-slate-900">{item.name}</p>
                      <p className="mt-1 text-xs font-semibold text-[#016564]">
                        {getDisplayCode(item)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-400">{item.code}</p>
                    </div>
                    <div className="shrink-0">{getStatusBadge(item.status)}</div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-[18px] bg-slate-50 p-3">
                    <div>
                      <p className="text-[11px] text-slate-500">الفئة</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {item.category}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">النوع</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {getTypeLabel(item.type)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">الكمية</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {formatNumber(item.quantity)} {item.unit}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">المتاح</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {formatNumber(item.availableQty)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">سعر المفرد</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {formatCurrency(item.unitPrice)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-slate-500">الإجمالي</p>
                      <p className="mt-1 text-[13px] font-semibold text-slate-800">
                        {formatCurrency(item.totalPrice)}
                      </p>
                    </div>
                  </div>

                  {canModify ? (
                    <div className="mt-4 flex flex-col gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full border border-slate-200"
                        onClick={() => openEditModal(item)}
                      >
                        تعديل
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full border border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => handleDelete(item.id)}
                      >
                        حذف
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="hidden sm:block mobile-scroll-x">
              <table className="min-w-[1150px] text-right">
                <thead className="bg-[#f4f8f8]">
                  <tr>
                    <th className="p-4 text-sm font-bold text-primary">الرمز</th>
                    <th className="p-4 text-sm font-bold text-primary">اسم المادة</th>
                    <th className="p-4 text-sm font-bold text-primary">الفئة</th>
                    <th className="p-4 text-sm font-bold text-primary">النوع</th>
                    <th className="p-4 text-sm font-bold text-primary">الكمية</th>
                    <th className="p-4 text-sm font-bold text-primary">المتاح</th>
                    <th className="p-4 text-sm font-bold text-primary">سعر المفرد</th>
                    <th className="p-4 text-sm font-bold text-primary">الإجمالي</th>
                    <th className="p-4 text-sm font-bold text-primary">الحالة</th>
                    {canModify ? (
                      <th className="p-4 text-sm font-bold text-primary">الإجراءات</th>
                    ) : null}
                  </tr>
                </thead>

                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      className="border-t border-slate-100 transition hover:bg-[#f8fbfb]"
                    >
                      <td className="p-4 text-sm font-bold text-slate-800">
                        <div className="space-y-1">
                          <div>{getDisplayCode(item)}</div>
                          <div className="text-xs font-medium text-slate-400">{item.code}</div>
                        </div>
                      </td>

                      <td className="p-4">
                        <div className="min-w-[220px]">
                          <p className="font-bold text-slate-900">{item.name}</p>
                        </div>
                      </td>

                      <td className="p-4 text-sm text-slate-700">
                        <div className="space-y-1">
                          <p className="font-semibold">{item.category}</p>
                          {item.subcategory ? (
                            <p className="text-xs text-slate-500">{item.subcategory}</p>
                          ) : null}
                        </div>
                      </td>

                      <td className="p-4 text-sm text-slate-700">{getTypeLabel(item.type)}</td>

                      <td className="p-4 text-sm font-bold text-slate-800">
                        {formatNumber(item.quantity)} {item.unit}
                      </td>

                      <td className="p-4 text-sm text-slate-700">
                        {formatNumber(item.availableQty)}
                      </td>

                      <td className="p-4 text-sm text-slate-700">
                        {formatCurrency(item.unitPrice)}
                      </td>

                      <td className="p-4 text-sm font-semibold text-slate-800">
                        {formatCurrency(item.totalPrice)}
                      </td>

                      <td className="p-4">{getStatusBadge(item.status)}</td>

                      {canModify ? (
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="border border-slate-200"
                              onClick={() => openEditModal(item)}
                            >
                              تعديل
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="border border-red-200 text-red-600 hover:bg-red-50"
                              onClick={() => handleDelete(item.id)}
                            >
                              حذف
                            </Button>
                          </div>
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <div className="flex flex-col gap-3 rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-3xl md:flex-row md:items-center md:justify-between">
        <div className="text-sm font-semibold text-slate-600">
          إجمالي النتائج: {formatNumber(pagination.total)}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Button
            variant="ghost"
            className="w-full"
            disabled={pagination.page <= 1}
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.max(prev.page - 1, 1),
              }))
            }
          >
            السابق
          </Button>

          <div className="flex items-center justify-center rounded-2xl bg-[#f4f8f8] px-3 py-2 text-center text-sm font-bold text-primary">
            {pagination.page} / {pagination.totalPages}
          </div>

          <Button
            variant="ghost"
            className="w-full"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() =>
              setPagination((prev) => ({
                ...prev,
                page: Math.min(prev.page + 1, prev.totalPages),
              }))
            }
          >
            التالي
          </Button>
        </div>
      </div>

      <Modal
        isOpen={isModalOpen}
        onClose={closeModal}
        title={selectedItem ? 'تعديل المادة' : 'إضافة مادة'}
      >
        <form onSubmit={handleFormSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2 rounded-2xl border border-[#d6e4e4] bg-[#f7fbfb] p-4">
              <p className="text-sm font-semibold text-slate-600">الرمز التلقائي</p>
              <p className="mt-2 text-lg font-extrabold text-[#016564]">{generatedCodePreview}</p>
              <p className="mt-1 text-xs text-slate-500">
                يتم توليد الرمز تلقائيًا من النظام حسب الفئة ونوع المادة
              </p>
            </div>

            <Input
              label="اسم المادة"
              value={formState.name}
              onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
              required
            />

            <Input
              label="الفئة"
              value={formState.category}
              onChange={(e) => setFormState((prev) => ({ ...prev, category: e.target.value }))}
              list="inventory-categories"
              required
            />

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">نوع المادة</label>
              <select
                value={formState.type}
                onChange={(e) =>
                  setFormState((prev) => ({
                    ...prev,
                    type: e.target.value as 'RETURNABLE' | 'CONSUMABLE',
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                required
              >
                <option value="RETURNABLE">مسترجعة</option>
                <option value="CONSUMABLE">مستهلكة</option>
              </select>
            </div>

            <Input
              label="الكمية"
              type="number"
              min="0"
              value={formState.quantity}
              onChange={(e) => setFormState((prev) => ({ ...prev, quantity: e.target.value }))}
              required
            />

            <Input
              label="سعر المفرد (اختياري)"
              type="number"
              min="0"
              step="0.01"
              value={formState.unitPrice}
              onChange={(e) => setFormState((prev) => ({ ...prev, unitPrice: e.target.value }))}
            />
          </div>

          <div className="rounded-2xl border border-[#d0b284]/40 bg-[#fbf7ef] p-4">
            <p className="text-sm font-semibold text-slate-700">الإجمالي التقديري</p>
            <p className="mt-2 text-xl font-extrabold text-[#7c5a24] sm:text-2xl">
              {formatCurrency(estimatedLineValue)}
            </p>
          </div>

          <datalist id="inventory-categories">
            {mergedCategories.map((categoryOption) => (
              <option key={categoryOption} value={categoryOption} />
            ))}
          </datalist>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={closeModal} className="w-full sm:w-auto">
              إلغاء
            </Button>
            <Button
              type="submit"
              className="w-full bg-[#016564] text-white hover:bg-[#014b4a] sm:w-auto"
              disabled={saving}
            >
              {saving ? 'جارٍ الحفظ...' : selectedItem ? 'حفظ التعديل' : 'إضافة'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}