'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type CleaningApiRow = {
  id: string;
  code: string;
  description?: string | null;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | string;
  status?: 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | string;
  createdAt?: string;
  requesterId?: string;
  requester?: {
    fullName?: string;
    department?: string;
    email?: string;
  } | null;
  notes?: string | null;
};

type SuggestionRow = {
  id: string;
  code?: string | null;
  title?: string | null;
  description?: string | null;
  status?: 'PENDING' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED' | string;
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT' | string;
  createdAt?: string;
  requesterId?: string;
  requester?: {
    fullName?: string;
    department?: string;
    email?: string;
  } | null;
  justification?: string | null;
  adminNotes?: string | null;
  category?: string | null;
};

type AttachmentPayload = {
  filename?: string;
  name?: string;
  contentType?: string;
  type?: string;
  base64Content?: string;
  base64?: string;
  data?: string;
};

type DisplayRow = {
  id: string;
  rowType: 'suggestion' | 'cleaning';
  code: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  createdAt?: string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  location: string;
  sourcePurpose: string;
  noteReason: string;
  notesCount: number;
  attachments: AttachmentPayload[];
  adminNotes: string;
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

function parseJustification(value?: string | null) {
  try {
    const parsed = JSON.parse(value || '{}');
    const attachments = Array.isArray(parsed?.attachments) ? parsed.attachments : [];
    return {
      location: String(parsed?.location || '').trim(),
      sourcePurpose: String(
        parsed?.requestSource || parsed?.programName || parsed?.area || parsed?.sourcePurpose || ''
      ).trim(),
      rawJustification: String(parsed?.rawJustification || '').trim(),
      attachments,
    };
  } catch {
    return {
      location: '',
      sourcePurpose: '',
      rawJustification: '',
      attachments: [] as AttachmentPayload[],
    };
  }
}

function statusMeta(value: string) {
  const raw = String(value || '').toUpperCase();
  if (raw === 'PENDING') return { label: 'بانتظار الاعتماد', variant: 'warning' as const };
  if (raw === 'APPROVED') return { label: 'معتمد', variant: 'success' as const };
  if (raw === 'IMPLEMENTED') return { label: 'تم إنشاء المسودة', variant: 'success' as const };
  if (raw === 'REJECTED') return { label: 'مرفوض', variant: 'danger' as const };
  if (raw === 'IN_PROGRESS') return { label: 'قيد المعالجة', variant: 'info' as const };
  if (raw === 'COMPLETED') return { label: 'مغلق', variant: 'success' as const };
  if (raw === 'CANCELLED') return { label: 'ملغي', variant: 'neutral' as const };
  return { label: '—', variant: 'neutral' as const };
}

function priorityMeta(value: string) {
  const raw = String(value || '').toUpperCase();
  if (raw === 'URGENT') return { label: 'عاجل', variant: 'danger' as const };
  if (raw === 'HIGH') return { label: 'عالٍ', variant: 'warning' as const };
  if (raw === 'NORMAL') return { label: 'عادي', variant: 'info' as const };
  if (raw === 'LOW') return { label: 'منخفض', variant: 'neutral' as const };
  return { label: 'عادي', variant: 'info' as const };
}

export default function CleaningPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<DisplayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DisplayRow | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState('');

  const isManager = user?.role === 'manager';

  async function fetchRows() {
    setLoading(true);
    try {
      const [suggestionsRes, maintenanceRes] = await Promise.all([
        fetch('/api/suggestions?category=CLEANING', { cache: 'no-store' }),
        fetch('/api/maintenance?category=CLEANING', { cache: 'no-store' }).catch(() => null),
      ]);

      const suggestionsJson = await suggestionsRes.json().catch(() => null);
      const maintenanceJson = maintenanceRes ? await maintenanceRes.json().catch(() => null) : null;

      const suggestionRows: DisplayRow[] = Array.isArray(suggestionsJson?.data)
        ? suggestionsJson.data.map((row: SuggestionRow) => {
            const parsed = parseJustification(row.justification);
            return {
              id: row.id,
              rowType: 'suggestion',
              code: row.code || `CLN-REQ-${String(row.id).slice(-6).toUpperCase()}`,
              title: row.title || 'طلب نظافة',
              description: row.description || '—',
              status: String(row.status || ''),
              priority: String(row.priority || 'NORMAL'),
              createdAt: row.createdAt,
              requesterName: row.requester?.fullName || '—',
              requesterDepartment: row.requester?.department || '—',
              requesterEmail: row.requester?.email || '',
              location: parsed.location || '—',
              sourcePurpose: parsed.sourcePurpose || '—',
              noteReason: parsed.rawJustification || '—',
              notesCount: Math.max(parsed.attachments.length, 1),
              attachments: parsed.attachments,
              adminNotes: row.adminNotes || '',
            };
          })
        : [];

      const cleaningRows: DisplayRow[] = Array.isArray(maintenanceJson?.data)
        ? maintenanceJson.data.map((row: CleaningApiRow) => ({
            id: row.id,
            rowType: 'cleaning',
            code: row.code,
            title: 'طلب نظافة',
            description: row.description || '—',
            status: String(row.status || ''),
            priority: String(row.priority || 'NORMAL'),
            createdAt: row.createdAt,
            requesterName: row.requester?.fullName || '—',
            requesterDepartment: row.requester?.department || '—',
            requesterEmail: row.requester?.email || '',
            location: '—',
            sourcePurpose: '—',
            noteReason: row.notes || '—',
            notesCount: 1,
            attachments: [],
            adminNotes: '',
          }))
        : [];

      const merged = [...suggestionRows, ...cleaningRows].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bTime - aTime;
      });

      setRows(merged);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      pending: rows.filter((row) => row.rowType === 'suggestion' && row.status === 'PENDING').length,
      approved: rows.filter((row) => row.status === 'APPROVED' || row.status === 'IMPLEMENTED').length,
      rejected: rows.filter((row) => row.status === 'REJECTED').length,
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const q = normalizeArabic(search);
    return rows.filter((row) => {
      const text = normalizeArabic(
        [
          row.code,
          row.title,
          row.description,
          row.requesterName,
          row.requesterDepartment,
          row.requesterEmail,
          row.location,
          row.sourcePurpose,
          row.noteReason,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return q ? text.includes(q) : true;
    });
  }, [rows, search]);

  const canModerate = selected?.rowType === 'suggestion' && selected?.status === 'PENDING' && isManager;

  async function handleAction(action: 'approve' | 'reject') {
    if (!selected || selected.rowType !== 'suggestion') return;

    setSubmitting(true);
    setFeedback('');

    try {
      const res = await fetch('/api/suggestions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          suggestionId: selected.id,
          action,
          adminNotes,
          targetDepartment: 'SUPPORT_SERVICES',
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || 'تعذر تنفيذ الإجراء');
      }

      setFeedback(
        action === 'approve'
          ? 'تم اعتماد طلب النظافة وإنشاء مسودة البريد في المراسلات الخارجية.'
          : 'تم رفض الطلب بنجاح.'
      );

      await fetchRows();

      if (action === 'approve') {
        setTimeout(() => {
          window.location.href = '/email-drafts';
        }, 800);
      } else {
        setTimeout(() => {
          setSelected(null);
          setAdminNotes('');
          setFeedback('');
        }, 800);
      }
    } catch (error: any) {
      setFeedback(error?.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isManager) {
    return (
      <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700 sm:rounded-[26px]">
        غير مصرح لك بالوصول لهذه الصفحة
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="space-y-2">
          <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">
            النظافة
          </h1>
          <p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">
            دورة طلب النظافة كاملة من المراجعة والاعتماد حتى إنشاء مسودة البريد وتحويلها إلى المراسلات الخارجية.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">إجمالي الطلبات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564] sm:text-xl">{stats.total}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">بانتظار الاعتماد</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284] sm:text-xl">{stats.pending}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">المعتمدة / المحالة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#498983] sm:text-xl">{stats.approved}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">المرفوضة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#7c1e3e] sm:text-xl">{stats.rejected}</div>
          </Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <Input
          label="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="رقم الطلب، مقدم الطلب، الموقع، أو الملاحظة"
        />
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
            لا توجد طلبات نظافة حالية
          </Card>
        ) : (
          filteredRows.map((row) => {
            const status = statusMeta(row.status);
            const priority = priorityMeta(row.priority);

            return (
              <Card
                key={`${row.rowType}-${row.id}`}
                className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm sm:rounded-[28px] sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="break-all font-mono text-sm font-bold text-[#016564]">{row.code}</div>
                      <Badge variant={status.variant}>{status.label}</Badge>
                      <Badge variant={priority.variant}>{priority.label}</Badge>
                      {row.rowType === 'suggestion' ? <Badge variant="info">طلب مرفوع</Badge> : <Badge variant="success">تمت الإحالة</Badge>}
                    </div>

                    <div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">
                      {row.title}
                    </div>

                    <div className="break-words text-sm leading-7 text-[#304342]">{row.description}</div>

                    <div className="grid gap-2 text-[12px] text-[#61706f] sm:grid-cols-2 sm:text-xs">
                      <div>التاريخ: {formatDate(row.createdAt)}</div>
                      <div className="break-words">مقدم الطلب: {row.requesterName}</div>
                      <div className="break-words">الإدارة: {row.requesterDepartment}</div>
                      <div className="break-words">الموقع: {row.location}</div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <Button
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setSelected(row);
                        setAdminNotes('');
                        setFeedback('');
                      }}
                    >
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
        onClose={() => {
          setSelected(null);
          setAdminNotes('');
          setFeedback('');
        }}
        title={selected ? `تفاصيل طلب النظافة ${selected.code}` : 'تفاصيل طلب النظافة'}
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">التاريخ</div>
                <div className="mt-1 text-sm leading-7 text-[#304342]">{formatDate(selected.createdAt)}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">الأولوية</div>
                <div className="mt-1 text-sm leading-7 text-[#304342]">{priorityMeta(selected.priority).label}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">الموقع</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.location}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">مقدم الطلب</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.requesterName}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">حيثيات الطلب</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.sourcePurpose}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">السبب / الملاحظة</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.noteReason}</div>
              </div>
              <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2 sm:rounded-2xl">
                <div className="text-xs font-bold text-[#016564]">التفاصيل</div>
                <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.description}</div>
              </div>
            </div>

            {canModerate ? (
              <div className="space-y-3 rounded-[18px] border border-[#e7ebea] bg-[#fafcfc] p-4 sm:rounded-2xl">
                <Input
                  label="ملاحظة المدير"
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="ملاحظة داخلية تظهر مع الإحالة أو الرفض"
                />

                {feedback ? (
                  <div className="rounded-2xl border border-[#d6e4e2] bg-white px-4 py-3 text-sm leading-7 text-[#304342]">
                    {feedback}
                  </div>
                ) : null}

                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                  <Button variant="ghost" onClick={() => handleAction('reject')} disabled={submitting} className="w-full sm:w-auto">
                    رفض
                  </Button>
                  <Button onClick={() => handleAction('approve')} disabled={submitting} className="w-full sm:w-auto">
                    اعتماد وإنشاء مسودة
                  </Button>
                </div>
              </div>
            ) : null}

            {selected.rowType === 'cleaning' ? (
              <div className="rounded-2xl border border-[#d6e4e2] bg-white px-4 py-3 text-sm leading-7 text-[#304342]">
                هذا الطلب معتمد بالفعل، ويمكن متابعة تنزيل البريد من صفحة المراسلات الخارجية.
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                variant="ghost"
                onClick={() => {
                  setSelected(null);
                  setAdminNotes('');
                  setFeedback('');
                }}
                className="w-full sm:w-auto"
              >
                إغلاق
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
