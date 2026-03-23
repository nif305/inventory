'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type ArchiveRequest = {
  id: string;
  code: string;
  purpose?: string;
  notes?: string | null;
  status: 'REJECTED' | 'ISSUED' | 'RETURNED' | 'PENDING' | string;
  createdAt: string;
  rejectionReason?: string | null;
  requester?: {
    fullName?: string;
    department?: string;
    email?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    item?: {
      name?: string;
      code?: string;
      unit?: string | null;
    };
  }>;
};

type SuggestionArchive = {
  id: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  status?: 'APPROVED' | 'IMPLEMENTED' | 'REJECTED' | string;
  createdAt?: string;
  requester?: {
    fullName?: string;
    department?: string;
    email?: string;
  } | null;
  category?: string | null;
};

type ArchiveRow = {
  id: string;
  type: 'materials' | 'service';
  code: string;
  title: string;
  description: string;
  status: string;
  createdAt: string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  details: string[];
};

const STATUS_MAP: Record<
  string,
  { label: string; variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }
> = {
  REJECTED: { label: 'ملغي / مرفوض', variant: 'danger' },
  ISSUED: { label: 'تم الصرف', variant: 'success' },
  RETURNED: { label: 'تمت الإعادة', variant: 'neutral' },
  APPROVED: { label: 'معتمد', variant: 'success' },
  IMPLEMENTED: { label: 'أُحيل للمراسلات', variant: 'info' },
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

export default function ArchivePage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<ArchiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'materials' | 'service'>('ALL');
  const [selected, setSelected] = useState<ArchiveRow | null>(null);

  const canViewAll = user?.role === 'manager' || user?.role === 'warehouse';

  useEffect(() => {
    let mounted = true;

    async function fetchArchive() {
      setLoading(true);
      try {
        const [requestsRes, suggestionsRes] = await Promise.all([
          fetch('/api/requests', { cache: 'no-store' }),
          fetch('/api/suggestions', { cache: 'no-store' }).catch(() => null),
        ]);

        const requestsJson = await requestsRes.json().catch(() => null);
        const suggestionsJson = suggestionsRes ? await suggestionsRes.json().catch(() => null) : null;

        const requestRows: ArchiveRow[] = (Array.isArray(requestsJson?.data) ? requestsJson.data : [])
          .filter((row: ArchiveRequest) => ['ISSUED', 'RETURNED', 'REJECTED'].includes(row.status))
          .map((row: ArchiveRequest) => ({
            id: row.id,
            type: 'materials',
            code: row.code,
            title: row.purpose || 'طلب مواد',
            description: row.notes || row.rejectionReason || '—',
            status: row.status,
            createdAt: row.createdAt,
            requesterName: row.requester?.fullName || '—',
            requesterDepartment: row.requester?.department || '—',
            requesterEmail: row.requester?.email || '',
            details: (row.items || []).map((item) => `${item.item?.name || 'صنف'} × ${item.quantity}`),
          }));

        const suggestionRows: ArchiveRow[] = (Array.isArray(suggestionsJson?.data) ? suggestionsJson.data : [])
          .filter((row: SuggestionArchive) => ['APPROVED', 'IMPLEMENTED', 'REJECTED'].includes(String(row.status || '')))
          .map((row: SuggestionArchive) => ({
            id: row.id,
            type: 'service',
            code: row.code || `SRV-${String(row.id).slice(-6).toUpperCase()}`,
            title: row.title || 'طلب خدمي',
            description: row.description || '—',
            status: String(row.status || ''),
            createdAt: row.createdAt || new Date().toISOString(),
            requesterName: row.requester?.fullName || '—',
            requesterDepartment: row.requester?.department || '—',
            requesterEmail: row.requester?.email || '',
            details: [String(row.category || '—')],
          }));

        const merged = [...requestRows, ...suggestionRows].sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

        if (mounted) setRows(merged);
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
      const matchesType = typeFilter === 'ALL' ? true : row.type === typeFilter;
      const haystack = normalizeArabic(
        [row.code, row.title, row.description, row.requesterName, row.requesterDepartment, ...row.details]
          .filter(Boolean)
          .join(' ')
      );
      const matchesSearch = q ? haystack.includes(q) : true;
      return matchesType && matchesSearch;
    });
  }, [rows, search, typeFilter]);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      materials: rows.filter((row) => row.type === 'materials').length,
      service: rows.filter((row) => row.type === 'service').length,
      rejected: rows.filter((row) => row.status === 'REJECTED').length,
    };
  }, [rows]);

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="space-y-2">
          <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">
            الأرشيف
          </h1>
          <p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">
            مرجع موحد للطلبات المنتهية: طلبات المواد والإرجاعات من جهة، والطلبات الخدمية التي أغلقت أو أُحيلت من جهة أخرى.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">إجمالي السجلات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.total}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">أرشيف المواد</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#498983]">{stats.materials}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">الأرشيف الخدمي</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284]">{stats.service}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">المرفوضة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#7c1e3e]">{stats.rejected}</div>
          </Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            label="بحث"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="الرمز، العنوان، مقدم الطلب، أو الأصناف"
          />

          <div className="flex flex-wrap gap-2 self-end">
            {[
              ['ALL', 'الكل'],
              ['materials', 'أرشيف المواد'],
              ['service', 'الأرشيف الخدمي'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTypeFilter(key as 'ALL' | 'materials' | 'service')}
                className={`rounded-full px-4 py-2 text-xs transition ${
                  typeFilter === key
                    ? 'bg-[#016564] text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-32 w-full rounded-[24px] sm:rounded-3xl" />
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm sm:rounded-[28px]">
            لا توجد سجلات أرشيف مطابقة
          </Card>
        ) : (
          filteredRows.map((row) => (
            <Card
              key={`${row.type}-${row.id}`}
              className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm sm:rounded-[28px] sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="break-all font-mono text-sm font-bold text-[#016564]">{row.code}</div>
                    <Badge variant={STATUS_MAP[row.status]?.variant || 'neutral'}>
                      {STATUS_MAP[row.status]?.label || row.status}
                    </Badge>
                    <Badge variant={row.type === 'materials' ? 'info' : 'warning'}>
                      {row.type === 'materials' ? 'مواد' : 'خدمي'}
                    </Badge>
                  </div>

                  <div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">
                    {row.title}
                  </div>

                  <div className="break-words text-sm leading-7 text-[#304342]">{row.description}</div>

                  <div className="grid gap-2 text-[12px] text-[#61706f] sm:grid-cols-2 sm:text-xs">
                    <div>التاريخ: {formatDate(row.createdAt)}</div>
                    <div className="break-words">مقدم الطلب: {row.requesterName}</div>
                    {canViewAll ? <div className="break-words">الإدارة: {row.requesterDepartment}</div> : null}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  <Button className="w-full sm:w-auto" onClick={() => setSelected(row)}>
                    فتح التفاصيل
                  </Button>
                </div>
              </div>
            </Card>
          ))
        )}
      </section>

      <Modal
        isOpen={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `تفاصيل السجل ${selected.code}` : 'تفاصيل السجل'}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3">
                <div className="text-xs font-bold text-[#016564]">النوع</div>
                <div className="mt-1 text-sm leading-7 text-[#304342]">{selected.type === 'materials' ? 'أرشيف المواد' : 'الأرشيف الخدمي'}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3">
                <div className="text-xs font-bold text-[#016564]">الحالة</div>
                <div className="mt-1 text-sm leading-7 text-[#304342]">{STATUS_MAP[selected.status]?.label || selected.status}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2">
                <div className="text-xs font-bold text-[#016564]">الوصف</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.description}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2">
                <div className="text-xs font-bold text-[#016564]">التفاصيل المرتبطة</div>
                <div className="mt-2 space-y-2 text-sm leading-7 text-[#304342]">
                  {selected.details.length ? selected.details.map((detail, idx) => <div key={idx}>• {detail}</div>) : '—'}
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="ghost" onClick={() => setSelected(null)} className="w-full sm:w-auto">
                إغلاق
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
