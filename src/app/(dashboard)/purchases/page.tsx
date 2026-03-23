'use client';

import { useEffect, useMemo, useState } from 'react';

type PurchaseRequest = {
  id: string;
  code?: string;
  title?: string;
  itemName?: string;
  areaLabel?: string;
  note?: string;
  requesterName?: string;
  requesterEmail?: string;
  sourcePurpose?: string;
  status?: string;
  createdAt?: string;
  type?: 'legacy' | 'suggestion';
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'بانتظار المدير',
  PENDING_APPROVAL: 'بانتظار المدير',
  OPEN: 'مفتوح',
  IN_PROGRESS: 'قيد المعالجة',
  APPROVED: 'تم الاعتماد',
  REJECTED: 'مرفوض',
  CLOSED: 'مغلق',
};

function formatDate(value?: string) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function normalizeStatus(value?: string) {
  if (!value) return 'PENDING';
  return value.toUpperCase();
}

function mapSuggestion(item: any): PurchaseRequest {
  return {
    id: item.id,
    code: item.code,
    title: item.title || 'طلب شراء مباشر',
    itemName: item.areaLabel || item.relatedItemName || '—',
    areaLabel: item.areaLabel || item.relatedItemName || '—',
    note: item.note || item.description || '—',
    requesterName: item.requesterName || item.createdBy?.name || '—',
    requesterEmail: item.requesterEmail || item.createdBy?.email || '—',
    sourcePurpose: item.sourcePurpose || '—',
    status: normalizeStatus(item.status),
    createdAt: item.createdAt,
    type: 'suggestion',
  };
}

function mapLegacy(item: any): PurchaseRequest {
  return {
    id: item.id,
    code: item.code || item.requestCode || item.id,
    title: item.title || 'طلب شراء مباشر',
    itemName: item.itemName || item.name || item.title || '—',
    areaLabel: item.location || item.areaLabel || item.itemName || '—',
    note: item.note || item.justification || item.description || '—',
    requesterName: item.requesterName || item.createdBy?.name || '—',
    requesterEmail: item.requesterEmail || item.createdBy?.email || '—',
    sourcePurpose: item.sourcePurpose || '—',
    status: normalizeStatus(item.status),
    createdAt: item.createdAt,
    type: 'legacy',
  };
}

export default function PurchasesPage() {
  const [items, setItems] = useState<PurchaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      try {
        const [legacyRes, suggestionsRes] = await Promise.all([
          fetch('/api/purchases', { cache: 'no-store' }),
          fetch('/api/suggestions?category=PURCHASE', { cache: 'no-store' }),
        ]);

        const legacyJson = legacyRes.ok ? await legacyRes.json() : [];
        const suggestionsJson = suggestionsRes.ok ? await suggestionsRes.json() : [];

        const legacyItems = Array.isArray(legacyJson)
          ? legacyJson.map(mapLegacy)
          : Array.isArray(legacyJson?.data)
          ? legacyJson.data.map(mapLegacy)
          : [];

        const suggestionItems = Array.isArray(suggestionsJson)
          ? suggestionsJson.map(mapSuggestion)
          : Array.isArray(suggestionsJson?.data)
          ? suggestionsJson.data.map(mapSuggestion)
          : [];

        const merged = [...suggestionItems, ...legacyItems].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        if (mounted) setItems(merged);
      } catch {
        if (mounted) setItems([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const filtered = useMemo(() => {
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'ALL' || normalizeStatus(item.status) === statusFilter;
      const haystack = [
        item.code,
        item.title,
        item.itemName,
        item.areaLabel,
        item.note,
        item.requesterName,
      ]
        .join(' ')
        .toLowerCase();
      const matchesSearch = !search.trim() || haystack.includes(search.trim().toLowerCase());
      return matchesStatus && matchesSearch;
    });
  }, [items, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      open: items.filter((item) => ['PENDING', 'PENDING_APPROVAL', 'OPEN', 'APPROVED'].includes(normalizeStatus(item.status))).length,
      processing: items.filter((item) => normalizeStatus(item.status) === 'IN_PROGRESS').length,
      closed: items.filter((item) => ['CLOSED', 'REJECTED'].includes(normalizeStatus(item.status))).length,
    };
  }, [items]);

  return (
    <div className="space-y-6" dir="rtl">
      <section className="rounded-[32px] border border-[#d6d7d4] bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold text-[#1f4f4e]">الشراء المباشر</h1>
            <p className="mt-3 text-lg text-[#6b7280]">متابعة طلبات الشراء المباشر الواردة من الموظفين والمرتبطة بالبيئة التشغيلية.</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[#d6d7d4] p-5">
            <div className="text-sm text-[#7b8088]">إجمالي الطلبات</div>
            <div className="mt-3 text-4xl font-bold text-[#1f4f4e]">{stats.total}</div>
          </div>
          <div className="rounded-2xl border border-[#d6d7d4] p-5">
            <div className="text-sm text-[#7b8088]">المفتوحة</div>
            <div className="mt-3 text-4xl font-bold text-[#1f4f4e]">{stats.open}</div>
          </div>
          <div className="rounded-2xl border border-[#d6d7d4] p-5">
            <div className="text-sm text-[#7b8088]">قيد المعالجة</div>
            <div className="mt-3 text-4xl font-bold text-[#1f4f4e]">{stats.processing}</div>
          </div>
          <div className="rounded-2xl border border-[#d6d7d4] p-5">
            <div className="text-sm text-[#7b8088]">المغلقة</div>
            <div className="mt-3 text-4xl font-bold text-[#1f4f4e]">{stats.closed}</div>
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-[#d6d7d4] bg-white p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4b5563]">الحالة</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-14 w-full rounded-2xl border border-[#d6d7d4] bg-white px-4 text-base outline-none"
            >
              <option value="ALL">الكل</option>
              <option value="PENDING">بانتظار المدير</option>
              <option value="APPROVED">تم الاعتماد</option>
              <option value="IN_PROGRESS">قيد المعالجة</option>
              <option value="REJECTED">مرفوض</option>
              <option value="CLOSED">مغلق</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-semibold text-[#4b5563]">بحث</label>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="الرمز، العنوان، اسم مقدم الطلب، العنصر"
              className="h-14 w-full rounded-2xl border border-[#d6d7d4] bg-white px-4 text-base outline-none"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-[32px] border border-[#d6d7d4] bg-white p-6 shadow-sm">
        {loading ? (
          <div className="rounded-2xl border border-dashed border-[#d6d7d4] p-10 text-center text-[#6b7280]">جارٍ تحميل الطلبات...</div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d6d7d4] p-10 text-center text-[#6b7280]">لا توجد طلبات شراء مباشرة مطابقة</div>
        ) : (
          filtered.map((item) => (
            <div key={`${item.type}-${item.id}`} className="rounded-3xl border border-[#e5e7eb] p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#eef6f5] px-3 py-1 text-sm font-bold text-[#1f4f4e]">{item.code || item.id}</span>
                  <span className="rounded-full bg-[#f6efe2] px-3 py-1 text-sm font-semibold text-[#8a6a23]">
                    {STATUS_LABELS[normalizeStatus(item.status)] || item.status || '—'}
                  </span>
                  <span className="rounded-full bg-[#f5f5f5] px-3 py-1 text-sm text-[#6b7280]">
                    {item.type === 'suggestion' ? 'من الطلبات التشغيلية الجديدة' : 'من الشراء المباشر'}
                  </span>
                </div>
                <div className="text-sm text-[#6b7280]">{formatDate(item.createdAt)}</div>
              </div>

              <h3 className="mt-4 text-2xl font-bold text-[#1f2937]">{item.title || 'طلب شراء مباشر'}</h3>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div>
                  <div className="text-sm text-[#7b8088]">العنصر / المجال</div>
                  <div className="mt-1 text-base font-semibold text-[#111827]">{item.areaLabel || item.itemName || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-[#7b8088]">مصدر الحاجة</div>
                  <div className="mt-1 text-base font-semibold text-[#111827]">{item.sourcePurpose || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-[#7b8088]">مقدم الطلب</div>
                  <div className="mt-1 text-base font-semibold text-[#111827]">{item.requesterName || '—'}</div>
                </div>
                <div>
                  <div className="text-sm text-[#7b8088]">البريد الإلكتروني</div>
                  <div className="mt-1 text-base font-semibold text-[#111827]">{item.requesterEmail || '—'}</div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl bg-[#fafafa] p-4 text-[#374151]">
                <div className="mb-1 text-sm text-[#7b8088]">الوصف</div>
                <div className="whitespace-pre-wrap text-base">{item.note || '—'}</div>
              </div>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
