'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type EmailDraftRow = {
  id: string;
  subject: string;
  to: string;
  cc?: string | null;
  body?: string | null;
  status: 'DRAFT' | 'COPIED' | 'SENT';
  createdAt?: string;
  updatedAt?: string;
  requestCode?: string;
  requestType?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterMobile?: string;
  requesterDepartment?: string;
  requesterJobTitle?: string;
  location?: string;
  itemName?: string;
  description?: string;
  attachments?: string[];
  preview?: string;
};

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

function statusMeta(status: EmailDraftRow['status']) {
  if (status === 'DRAFT') return { label: 'مسودة', tone: 'bg-slate-100 text-slate-700' };
  if (status === 'COPIED') return { label: 'مؤرشفة بعد التنزيل', tone: 'bg-[#016564]/10 text-[#016564]' };
  return { label: 'مرسلة', tone: 'bg-emerald-100 text-emerald-700' };
}

export default function EmailDraftsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<EmailDraftRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<EmailDraftRow | null>(null);

  const isManager = user?.role === 'manager';

  async function fetchRows() {
    setLoading(true);
    try {
      const res = await fetch('/api/email-drafts', { cache: 'no-store' });
      const data = await res.json();
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  const filteredRows = useMemo(() => {
    const q = normalizeArabic(search);
    return rows.filter((row) => {
      const haystack = normalizeArabic(
        [
          row.subject,
          row.to,
          row.requestCode,
          row.requestType,
          row.requesterName,
          row.requesterDepartment,
          row.location,
          row.itemName,
          row.description,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return q ? haystack.includes(q) : true;
    });
  }, [rows, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    drafts: rows.filter((row) => row.status === 'DRAFT').length,
    copied: rows.filter((row) => row.status === 'COPIED').length,
    sent: rows.filter((row) => row.status === 'SENT').length,
  }), [rows]);

  if (!isManager) {
    return <div className="rounded-[22px] border border-red-200 bg-red-50 p-6 text-center text-red-700 sm:rounded-[26px]">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="space-y-2">
          <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">المراسلات الخارجية</h1>
          <p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">استعراض المسودات الخارجية الجاهزة للتنزيل بصيغة بريد قابلة للتعديل.</p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl"><div className="text-[12px] text-[#6f7b7a]">إجمالي العناصر</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564] sm:text-xl">{stats.total}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl"><div className="text-[12px] text-[#6f7b7a]">المسودات</div><div className="mt-1 text-[22px] font-extrabold leading-none text-slate-700 sm:text-xl">{stats.drafts}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl"><div className="text-[12px] text-[#6f7b7a]">المؤرشفة بعد التنزيل</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284] sm:text-xl">{stats.copied}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl"><div className="text-[12px] text-[#6f7b7a]">المرسلة</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#498983] sm:text-xl">{stats.sent}</div></Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <Input label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الموضوع، رقم الطلب، مقدم الطلب، الموقع، أو نوع الطلب" />
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-40 w-full rounded-[24px] sm:rounded-3xl" />)}</div>
        ) : filteredRows.length === 0 ? (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm sm:rounded-[28px]">لا توجد مراسلات مطابقة</Card>
        ) : (
          filteredRows.map((row) => {
            const status = statusMeta(row.status);
            return (
              <Card key={row.id} className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-3 py-1 text-[11px] leading-none ${status.tone}`}>{status.label}</span>
                      <span className="rounded-full bg-[#f3ece0] px-3 py-1 text-[11px] leading-none text-[#8a6a28]">{row.requestType || 'طلب'}</span>
                      <span className="text-sm font-extrabold text-[#016564]">{row.requestCode || '—'}</span>
                    </div>

                    <div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">{row.subject}</div>
                    <div className="grid gap-2 text-[12px] text-[#61706f] sm:grid-cols-2 xl:grid-cols-3 sm:text-xs">
                      <div>مقدم الطلب: {row.requesterName || '—'}</div>
                      <div>الإدارة: {row.requesterDepartment || '—'}</div>
                      <div>الموقع: {row.location || '—'}</div>
                      <div>العنصر المطلوب: {row.itemName || '—'}</div>
                      <div className="break-all">إلى: {row.to || '—'}</div>
                      <div>الإنشاء: {formatDateTime(row.createdAt)}</div>
                    </div>
                    <div className="text-sm leading-7 text-[#304342]">{row.preview || row.description || '—'}</div>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <Button className="w-full sm:w-auto" onClick={() => setSelected(row)}>فتح التفاصيل</Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `تفاصيل المراسلة: ${selected.subject}` : 'تفاصيل المراسلة'} size="full" bodyClassName="p-0 sm:p-0">
        {selected ? (
          <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-6 xl:gap-6">
            <div className="space-y-4 rounded-[24px] border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
              <div className="text-sm font-extrabold text-[#016564]">ملخص المراسلة</div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">الموضوع</div><div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.subject}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">رقم الطلب</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.requestCode || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">نوع الطلب</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.requestType || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">إلى</div><div className="mt-1 break-all text-sm leading-7 text-[#304342]">{selected.to || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">مقدم الطلب</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.requesterName || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">الإدارة</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.requesterDepartment || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">البريد الإلكتروني</div><div className="mt-1 break-all text-sm leading-7 text-[#304342]">{selected.requesterEmail || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">الجوال</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.requesterMobile || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">الموقع</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.location || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">العنصر المطلوب</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.itemName || '—'}</div></div>
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">المرفقات المرفوعة</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.attachments?.length ? selected.attachments.join('، ') : 'لا توجد مرفقات'}</div></div>
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-[#e7ebea] bg-[#fcfdfd] p-4 sm:p-5">
              <div className="text-sm font-extrabold text-[#016564]">المذكرة الجاهزة للإرسال</div>
              <div dir="rtl" className="overflow-x-auto rounded-2xl border border-[#e7ebea] bg-white p-4 leading-8" dangerouslySetInnerHTML={{ __html: selected.body || '<div>—</div>' }} />
            </div>

            <div className="sm:col-span-2 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                className="w-full sm:w-auto"
                onClick={async () => {
                  try {
                    const res = await fetch(`/api/email-drafts/${selected.id}/download`);
                    const data = res.headers.get('content-type')?.includes('application/json') ? await res.json() : null;
                    if (!res.ok) {
                      throw new Error(data?.error || 'تعذر تنزيل ملف المراسلة حاليًا');
                    }
                    const blob = data ? new Blob([JSON.stringify(data)]) : await res.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selected.requestCode || 'email-draft'}.eml`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    window.URL.revokeObjectURL(url);
                    setSelected(null);
                    fetchRows();
                  } catch (error: any) {
                    alert(error?.message || 'تعذر تنزيل ملف المراسلة حاليًا');
                  }
                }}
              >
                تنزيل .eml
              </Button>
              <Button variant="ghost" onClick={() => setSelected(null)} className="w-full sm:w-auto">إغلاق</Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
