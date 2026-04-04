'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type Row = {
  id: string;
  subject: string;
  to: string;
  status: 'DRAFT' | 'COPIED' | 'SENT';
  createdAt?: string;
  copiedAt?: string | null;
  requestCode: string;
  requestTypeLabel: string;
  requesterName: string;
  requesterDepartment: string;
  requesterEmail: string;
  requesterMobile: string;
  requesterJobTitle: string;
  location: string;
  itemName: string;
  description: string;
  attachments: string[];
  body: string;
};

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

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'Asia/Riyadh',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function statusMeta(status: Row['status']) {
  if (status === 'SENT') return { label: 'مرسلة', tone: 'bg-emerald-100 text-emerald-700' };
  if (status === 'COPIED') return { label: 'مؤرشفة بعد التنزيل', tone: 'bg-[#d0b284]/15 text-[#8a6a28]' };
  return { label: 'مسودة', tone: 'bg-slate-100 text-slate-700' };
}

export default function EmailDraftsPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Row | null>(null);
  const [downloading, setDownloading] = useState(false);

  const isManager = user?.role === 'manager';

  async function load() {
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
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeArabic(search);
    return rows.filter((row) => {
      const haystack = normalizeArabic([
        row.subject,
        row.requestCode,
        row.requestTypeLabel,
        row.requesterName,
        row.requesterDepartment,
        row.location,
        row.itemName,
        row.description,
      ].join(' '));
      return q ? haystack.includes(q) : true;
    });
  }, [rows, search]);

  const stats = useMemo(() => ({
    total: rows.length,
    drafts: rows.filter((r) => r.status === 'DRAFT').length,
    copied: rows.filter((r) => r.status === 'COPIED').length,
    sent: rows.filter((r) => r.status === 'SENT').length,
  }), [rows]);

  async function handleDownload(id: string) {
    setDownloading(true);
    try {
      const response = await fetch(`/api/email-drafts/${id}/download`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || 'تعذر تنزيل ملف المراسلة حاليًا');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      const disposition = response.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename="?([^";]+)"?/i);
      link.href = url;
      link.download = match?.[1] || 'draft.eml';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      await load();
    } catch (error: any) {
      alert(error?.message || 'تعذر تنزيل ملف المراسلة حاليًا');
    } finally {
      setDownloading(false);
    }
  }

  if (!isManager) {
    return <div className="rounded-[24px] border border-red-200 bg-red-50 p-6 text-center text-red-700">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="space-y-2">
          <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">المراسلات الخارجية</h1>
          <p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">استعراض المسودات الخارجية الجاهزة للتنزيل بصيغة بريد قابلة للتعديل.</p>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">إجمالي العناصر</div><div className="mt-1 text-[22px] font-extrabold text-[#016564]">{stats.total}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">المسودات</div><div className="mt-1 text-[22px] font-extrabold text-slate-700">{stats.drafts}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">المؤرشفة بعد التنزيل</div><div className="mt-1 text-[22px] font-extrabold text-[#d0b284]">{stats.copied}</div></Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">المرسلة</div><div className="mt-1 text-[22px] font-extrabold text-[#498983]">{stats.sent}</div></Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <Input label="بحث" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="الموضوع، رقم الطلب، مقدم الطلب، الموقع، أو نوع الطلب" />
      </section>

      <section className="space-y-3">
        {loading ? (
          <div className="space-y-3">{[1, 2, 3].map((n) => <Skeleton key={n} className="h-32 w-full rounded-[24px]" />)}</div>
        ) : filtered.length ? (
          filtered.map((row) => {
            const status = statusMeta(row.status);
            return (
              <Card key={row.id} className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm sm:rounded-[28px] sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-bold text-[#016564]">{row.requestCode}</span>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${status.tone}`}>{status.label}</span>
                      <span className="rounded-full bg-[#016564]/10 px-3 py-1 text-xs font-bold text-[#016564]">{row.requestTypeLabel}</span>
                    </div>
                    <div className="text-[15px] font-bold leading-7 text-[#152625] sm:text-base break-words">{row.subject}</div>
                    <div className="grid gap-2 text-[12px] text-[#61706f] sm:grid-cols-2 sm:text-xs">
                      <div>مقدم الطلب: {row.requesterName}</div>
                      <div>الإدارة: {row.requesterDepartment}</div>
                      <div>الموقع: {row.location}</div>
                      <div>العنصر المطلوب: {row.itemName}</div>
                    </div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto">
                    <Button className="w-full sm:w-auto" onClick={() => setSelected(row)}>فتح التفاصيل</Button>
                  </div>
                </div>
              </Card>
            );
          })
        ) : (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">لا توجد مراسلات مطابقة</Card>
        )}
      </section>

      <Modal isOpen={!!selected} onClose={() => setSelected(null)} title={selected ? `تفاصيل المراسلة: ${selected.subject}` : 'تفاصيل المراسلة'} size="full" bodyClassName="sm:p-7">
        {selected ? (
          <div className="grid gap-6 2xl:grid-cols-[0.95fr_1.45fr]">
            <div className="space-y-4">
              <div className="grid gap-3 lg:grid-cols-2">
                {[
                  ['الموضوع', selected.subject],
                  ['رقم الطلب', selected.requestCode],
                  ['نوع الطلب', selected.requestTypeLabel],
                  ['الجهة الموجّه إليها', selected.to || '—'],
                  ['مقدم الطلب', selected.requesterName],
                  ['الإدارة', selected.requesterDepartment],
                  ['البريد الإلكتروني', selected.requesterEmail],
                  ['الجوال', selected.requesterMobile],
                  ['الصفة الوظيفية', selected.requesterJobTitle],
                  ['الموقع', selected.location],
                  ['العنصر المطلوب', selected.itemName],
                  ['تاريخ الإنشاء', formatDate(selected.createdAt)],
                  ['آخر تحديث للحالة', formatDate(selected.copiedAt)],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3">
                    <div className="text-xs font-bold text-[#016564]">{label}</div>
                    <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{value || '—'}</div>
                  </div>
                ))}
                <div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2">
                  <div className="text-xs font-bold text-[#016564]">المرفقات المرفوعة</div>
                  <div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.attachments.length ? selected.attachments.join('، ') : 'لا توجد مرفقات'}</div>
                </div>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button loading={downloading} onClick={() => handleDownload(selected.id)} className="w-full sm:w-auto">تنزيل .eml</Button>
                <Button variant="ghost" onClick={() => setSelected(null)} className="w-full sm:w-auto">إغلاق</Button>
              </div>
            </div>
            <div className="rounded-[22px] border border-[#d6d7d4] bg-[#f8fbfb] p-4">
              <div className="mb-3 text-sm font-bold text-[#016564]">المذكرة الجاهزة للإرسال</div>
              <div className="max-w-none text-right text-[14px] leading-8 text-[#304342] sm:text-[15px]" dir="rtl" dangerouslySetInnerHTML={{ __html: selected.body }} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
