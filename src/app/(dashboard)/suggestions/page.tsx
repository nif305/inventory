'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/context/AuthContext';

type SuggestionType = 'MAINTENANCE' | 'CLEANING' | 'PURCHASE' | 'OTHER';
type SuggestionStatus = 'PENDING' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'IMPLEMENTED';
type RequestScope = 'PROGRAM' | 'BUILDING';

type SuggestionRow = {
  id: string;
  code?: string;
  linkedDraftId?: string | null;
  title: string;
  description?: string | null;
  type?: SuggestionType;
  category?: SuggestionType;
  status: SuggestionStatus;
  createdAt?: string;
  requester?: { fullName?: string; department?: string; email?: string } | null;
};

type FormState = {
  scope: RequestScope;
  programName: string;
  location: string;
  area: string;
  customArea: string;
  issueSummary: string;
  itemName: string;
  quantity: string;
  otherTitle: string;
  otherRecipient: string;
};

const DEFAULT_FORM: FormState = {
  scope: 'BUILDING', programName: '', location: '', area: '', customArea: '', issueSummary: '', itemName: '', quantity: '1', otherTitle: '', otherRecipient: ''
};
const MAINTENANCE_PARTS = ['التكييف','الإلكترونيات','الطاولات والكراسي','الأبواب','الإنارة','الشاشات','القاعات التدريبية','ممرات المبنى','دورات المياه','أخرى'];
const CLEANING_AREAS = ['قاعة تدريبية','ممرات المبنى','دورات المياه','منطقة الضيافة','مكاتب','مداخل المبنى','أخرى'];

function formatDateTime(value?: string | null) { if (!value) return '—'; try { return new Intl.DateTimeFormat('ar-SA',{year:'numeric',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); } catch { return '—'; } }
function normalizeArabic(value: string) { return (value || '').toLowerCase().trim().replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '').replace(/\s+/g, ' '); }
function resolveType(row: SuggestionRow): SuggestionType { return (row.type || row.category || 'OTHER') as SuggestionType; }
function typeMeta(type: SuggestionType) { if (type==='MAINTENANCE') return {label:'طلب صيانة',variant:'danger' as const}; if (type==='CLEANING') return {label:'طلب نظافة',variant:'info' as const}; if (type==='PURCHASE') return {label:'طلب شراء مباشر',variant:'warning' as const}; return {label:'طلبات أخرى',variant:'neutral' as const}; }
function statusMeta(status: SuggestionStatus) { if (status==='PENDING') return {label:'بانتظار المدير',variant:'warning' as const}; if (status==='UNDER_REVIEW') return {label:'قيد المراجعة',variant:'info' as const}; if (status==='APPROVED') return {label:'معتمد',variant:'success' as const}; if (status==='REJECTED') return {label:'مرفوض',variant:'danger' as const}; return {label:'تمت المعالجة',variant:'neutral' as const}; }
function buildPageTitle(type: SuggestionType) { if (type==='MAINTENANCE') return 'طلب صيانة'; if (type==='CLEANING') return 'طلب نظافة'; if (type==='PURCHASE') return 'طلب شراء مباشر'; return 'طلب آخر'; }
function buildDefaultRecipient(type: SuggestionType) { if (type==='PURCHASE') return 'wa.n1@nauss.edu.sa'; if (type==='MAINTENANCE' || type==='CLEANING') return 'ssd@nauss.edu.sa,AAlosaimi@nauss.edu.sa'; return ''; }
function parseAdminNotes(value?: string | null) { if (!value) return { note:'', linkedCode:'', linkedDraftId:'' }; try { const parsed = JSON.parse(value); return { note: parsed?.adminNotes || '', linkedCode: parsed?.linkedCode || parsed?.publicCode || '', linkedDraftId: parsed?.linkedDraftId || '' }; } catch { return { note:String(value), linkedCode:'', linkedDraftId:'' }; } }

export default function SuggestionsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<SuggestionRow | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<{type:'success'|'error'; message:string}|null>(null);

  const canManage = user?.role === 'manager';
  const requestedType = (searchParams.get('type') || '').toUpperCase() as SuggestionType;
  const isCreateMode = searchParams.get('new') === '1';
  const activeType: SuggestionType = ['MAINTENANCE','CLEANING','PURCHASE','OTHER'].includes(requestedType) ? requestedType : 'OTHER';

  async function fetchRows() {
    setLoading(true);
    try {
      const categoryQuery = !canManage && isCreateMode ? `?category=${activeType}` : canManage ? '' : '';
      const res = await fetch(`/api/suggestions${categoryQuery}`, { cache: 'no-store' });
      const data = await res.json();
      setRows(Array.isArray(data?.data) ? data.data : []);
    } catch { setRows([]); } finally { setLoading(false); }
  }
  useEffect(() => { fetchRows(); }, [searchParams.toString()]);
  useEffect(() => { if (!selected) { setAdminNotes(''); return; } setAdminNotes(parseAdminNotes((selected as any).adminNotes).note || ''); }, [selected]);

  const stats = useMemo(() => ({ total: rows.length, pending: rows.filter((r)=>r.status==='PENDING').length, approved: rows.filter((r)=>r.status==='APPROVED'||r.status==='IMPLEMENTED').length, rejected: rows.filter((r)=>r.status==='REJECTED').length }), [rows]);
  const filteredRows = useMemo(() => { const q=normalizeArabic(search); return rows.filter((row)=>{ const type=resolveType(row); const haystack=normalizeArabic([row.code,row.title,row.description,row.requester?.fullName,row.requester?.department,typeMeta(type).label,statusMeta(row.status).label].filter(Boolean).join(' ')); return q ? haystack.includes(q) : true; }); }, [rows, search]);
  const pendingRows = useMemo(() => filteredRows.filter((r)=>r.status==='PENDING' || r.status==='UNDER_REVIEW'), [filteredRows]);
  const processedRows = useMemo(() => filteredRows.filter((r)=>!(r.status==='PENDING' || r.status==='UNDER_REVIEW')), [filteredRows]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm((prev) => ({ ...prev, [key]: value })); }
  function resetCreateState() { setForm(DEFAULT_FORM); setAttachments([]); setFeedback(null); }
  async function fileToAttachmentPayload(file: File) { const buffer = await file.arrayBuffer(); let binary=''; const bytes=new Uint8Array(buffer); const chunkSize=0x8000; for (let i=0;i<bytes.length;i+=chunkSize) { const chunk=bytes.subarray(i,i+chunkSize); binary += String.fromCharCode(...chunk); } return { filename:file.name, contentType:file.type || 'application/octet-stream', base64Content:btoa(binary) }; }
  function closeCreateMode() { resetCreateState(); router.replace('/suggestions'); }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFeedback(null);
    const areaName = form.area === 'أخرى' ? form.customArea.trim() : form.area.trim();
    const quantityValue = Math.max(1, Number(form.quantity || 1));
    const requestSource = form.scope === 'PROGRAM' ? `مرتبط ببرنامج تدريبي${form.programName ? ` | اسم البرنامج: ${form.programName}` : ''}` : 'مرتبط بملاحظة عامة في المبنى';
    let title = buildPageTitle(activeType);
    let description = form.issueSummary.trim();
    let itemName = '';
    let location = form.location.trim();
    let externalRecipient = buildDefaultRecipient(activeType);

    if (activeType === 'MAINTENANCE' || activeType === 'CLEANING') {
      itemName = areaName;
      if (!areaName || !description) { setFeedback({ type:'error', message:`أكمل حقول ${activeType === 'MAINTENANCE' ? 'طلب الصيانة' : 'طلب النظافة'} المطلوبة` }); return; }
    }
    if (activeType === 'PURCHASE') {
      title = 'طلب شراء مباشر'; itemName = form.itemName.trim();
      if (!itemName || !description) { setFeedback({ type:'error', message:'أكمل حقول طلب الشراء المباشر المطلوبة' }); return; }
    }
    if (activeType === 'OTHER') {
      title = form.otherTitle.trim() || 'طلب آخر';
      if (!title || !description) { setFeedback({ type:'error', message:'أكمل حقول الطلب الآخر المطلوبة' }); return; }
      externalRecipient = form.otherRecipient.trim();
    }
    const attachmentPayload = await Promise.all(attachments.map(fileToAttachmentPayload));
    setSubmitting(true);
    try {
      const res = await fetch('/api/suggestions', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ category: activeType, title, description, itemName, quantity: quantityValue, location, externalRecipient, requestSource, programName: form.programName.trim(), area: areaName, attachments: attachmentPayload }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { setFeedback({ type:'error', message: data?.error || 'تعذر حفظ الطلب' }); return; }
      setFeedback({ type:'success', message:'تم رفع الطلب بنجاح وإحالته إلى المدير للمراجعة' });
      resetCreateState();
      router.replace('/suggestions');
      await fetchRows();
    } finally { setSubmitting(false); }
  }

  async function handleDecision(action: 'approve' | 'reject') {
    if (!selected) return; setFeedback(null); setProcessing(true);
    try {
      const targetDepartment = resolveType(selected) === 'PURCHASE' ? 'FINANCE' : resolveType(selected) === 'OTHER' ? 'OTHER' : 'SUPPORT_SERVICES';
      const res = await fetch('/api/suggestions', { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ suggestionId:selected.id, action, adminNotes, targetDepartment }) });
      const data = await res.json().catch(()=>({}));
      if (!res.ok) { setFeedback({ type:'error', message: data?.error || 'تعذر معالجة الطلب' }); return; }
      setFeedback({ type:'success', message: action === 'approve' ? 'تم اعتماد الطلب بنجاح وإنشاء مسودة المراسلة الخارجية' : 'تم رفض الطلب' });
      setSelected(null); await fetchRows();
    } finally { setProcessing(false); }
  }

  function ServiceButtons() {
    const items: Array<{type:SuggestionType; label:string}> = [
      {type:'MAINTENANCE', label:'طلب صيانة'}, {type:'CLEANING', label:'طلب نظافة'}, {type:'PURCHASE', label:'شراء مباشر'}, {type:'OTHER', label:'طلب آخر'}
    ];
    return <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">{items.map((item)=><Button key={item.type} variant={activeType===item.type && isCreateMode ? 'primary' : 'ghost'} className="w-full" onClick={()=>router.push(`/suggestions?type=${item.type}&new=1`)}>{item.label}</Button>)}</div>;
  }

  function renderRow(row: SuggestionRow) {
    const type = resolveType(row); const typeBadge = typeMeta(type); const statusBadge = statusMeta(row.status);
    return <Card key={row.id} className="rounded-[24px] border border-[#d6d7d4] p-4 shadow-sm sm:rounded-[28px] sm:p-5"><div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0 space-y-3"><div className="flex flex-wrap items-center gap-2"><div className="font-mono text-sm font-bold text-[#016564]">{row.code || row.id}</div><Badge variant={typeBadge.variant}>{typeBadge.label}</Badge><Badge variant={statusBadge.variant}>{statusBadge.label}</Badge></div><div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">{row.title}</div>{row.description ? <div className="break-words text-sm leading-7 text-[#304342]">{row.description}</div> : null}<div className="grid gap-2 text-[12px] text-[#61706f] sm:grid-cols-2 sm:text-xs"><div>التاريخ: {formatDateTime(row.createdAt)}</div><div className="break-words">مقدم الطلب: {row.requester?.fullName || '—'}</div></div></div><div className="flex w-full flex-col gap-2 sm:w-auto"><Button className="w-full sm:w-auto" onClick={()=>setSelected(row)}>فتح التفاصيل</Button>{row.linkedDraftId && canManage ? <Button variant="ghost" className="w-full sm:w-auto" onClick={()=>router.push('/email-drafts')}>فتح المراسلات</Button> : null}</div></div></Card>;
  }

  return <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2"><h2 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">الطلبات المرفوعة</h2><p className="text-[13px] leading-7 text-[#61706f] sm:text-sm">متابعة طلبات الصيانة، النظافة، الشراء المباشر، والطلبات الأخرى بعد رفعها.</p></div>
          {!canManage ? <Button className="w-full sm:w-auto" onClick={()=>router.push('/suggestions?new=1&type=MAINTENANCE')}>طلب جديد</Button> : null}
        </div>
        {!canManage ? <div className="mt-4"><ServiceButtons /></div> : null}
        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4"><Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">إجمالي الطلبات</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.total}</div></Card><Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">بانتظار المدير</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284]">{stats.pending}</div></Card><Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">المعالجة</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#498983]">{stats.approved}</div></Card><Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none"><div className="text-[12px] text-[#6f7b7a]">المرفوضة</div><div className="mt-1 text-[22px] font-extrabold leading-none text-[#7c1e3e]">{stats.rejected}</div></Card></div>
      </section>
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5"><Input label="بحث" value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ابحث برقم الطلب أو العنوان أو اسم مقدم الطلب" /></section>
      {canManage ? <section className="space-y-6"><div><div className="mb-3 text-lg font-bold text-[#016564]">طلبات تحتاج اعتماد</div><div className="space-y-3">{loading ? [1,2].map((i)=><Skeleton key={i} className="h-32 w-full rounded-[24px]" />) : pendingRows.length ? pendingRows.map(renderRow) : <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">لا توجد طلبات بانتظار الاعتماد</Card>}</div></div><div><div className="mb-3 text-lg font-bold text-[#016564]">طلبات تمت معالجتها</div><div className="space-y-3">{loading ? null : processedRows.length ? processedRows.map(renderRow) : <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">لا توجد طلبات معالجة</Card>}</div></div></section> : <section className="space-y-3">{loading ? [1,2,3].map((i)=><Skeleton key={i} className="h-32 w-full rounded-[24px]" />) : filteredRows.length ? filteredRows.map(renderRow) : <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">لا توجد طلبات مطابقة</Card>}</section>}
      <Modal isOpen={isCreateMode} onClose={closeCreateMode} title={buildPageTitle(activeType)} size="2xl" bodyClassName="overflow-visible">
        <form onSubmit={handleCreate} className="space-y-4">
          {feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type==='error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.message}</div> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><label className="block text-sm font-semibold text-slate-700">مصدر الحاجة</label><select value={form.scope} onChange={(e)=>updateForm('scope', e.target.value as RequestScope)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"><option value="BUILDING">مرتبط بملاحظة عامة في المبنى</option><option value="PROGRAM">مرتبط ببرنامج تدريبي</option></select></div>
            <Input label="الموقع" value={form.location} onChange={(e)=>updateForm('location', e.target.value)} placeholder="مثال: القاعة 3 أو الممر الغربي" />
          </div>
          {form.scope === 'PROGRAM' ? <Input label="اسم البرنامج التدريبي (إن وجد)" value={form.programName} onChange={(e)=>updateForm('programName', e.target.value)} placeholder="اكتب اسم البرنامج" /> : null}
          {(activeType==='MAINTENANCE' || activeType==='CLEANING') ? <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-2"><label className="block text-sm font-semibold text-slate-700">{activeType==='MAINTENANCE' ? 'الجزء المطلوب صيانته' : 'الموقع أو الجزء المطلوب تنظيفه'}</label><select value={form.area} onChange={(e)=>updateForm('area', e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"><option value="">اختر</option>{(activeType==='MAINTENANCE' ? MAINTENANCE_PARTS : CLEANING_AREAS).map((option)=><option key={option} value={option}>{option}</option>)}</select></div>{form.area==='أخرى' ? <Input label="تحديد الجزء" value={form.customArea} onChange={(e)=>updateForm('customArea', e.target.value)} placeholder="اكتب الجزء المطلوب" /> : <div />}</div> : null}
          {activeType==='PURCHASE' ? <div className="grid gap-3 sm:grid-cols-2"><Input label="الصنف المطلوب" value={form.itemName} onChange={(e)=>updateForm('itemName', e.target.value)} placeholder="اكتب اسم الصنف المطلوب" /><Input label="الكمية" type="number" min="1" value={form.quantity} onChange={(e)=>updateForm('quantity', e.target.value)} placeholder="1" /></div> : null}
          {activeType==='OTHER' ? <div className="grid gap-3 sm:grid-cols-2"><Input label="عنوان الطلب" value={form.otherTitle} onChange={(e)=>updateForm('otherTitle', e.target.value)} placeholder="مثال: طلب معالجة تشغيلية أخرى" /><Input label="الجهة المقترحة مبدئيًا (اختياري)" value={form.otherRecipient} onChange={(e)=>updateForm('otherRecipient', e.target.value)} placeholder="يترك فارغًا إذا كان المدير سيحدده" /></div> : null}
          <div className="space-y-2"><label className="block text-sm font-semibold text-slate-700">سبب الطلب أو الملاحظة</label><textarea value={form.issueSummary} onChange={(e)=>updateForm('issueSummary', e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10" placeholder="اكتب وصفًا واضحًا ومباشرًا" /></div>
          <div className="space-y-2"><label className="block text-sm font-semibold text-slate-700">المرفقات (اختياري)</label><input type="file" accept="image/*" multiple onChange={(e)=>setAttachments(Array.from(e.target.files || []))} className="block w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700" />{attachments.length>0 ? <div className="rounded-2xl border border-[#e7ebea] bg-[#f8fbfb] px-4 py-3 text-sm text-[#304342]">الملفات المختارة: {attachments.map((file)=>file.name).join(' ، ')}</div> : null}</div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={closeCreateMode} className="w-full sm:w-auto">إلغاء</Button><Button type="submit" loading={submitting} className="w-full sm:w-auto">إرسال الطلب</Button></div>
        </form>
      </Modal>
      <Modal isOpen={!!selected} onClose={()=>setSelected(null)} title={selected ? `تفاصيل الطلب ${selected.code || ''}` : 'تفاصيل الطلب'} size="2xl" bodyClassName="overflow-visible">
        {selected ? <div className="space-y-4">{feedback ? <div className={`rounded-2xl border px-4 py-3 text-sm ${feedback.type==='error' ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{feedback.message}</div> : null}<div className="grid gap-3 sm:grid-cols-2"><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">الرمز</div><div className="mt-1 text-sm leading-7 text-[#304342]">{selected.code || selected.id}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">النوع</div><div className="mt-1 text-sm leading-7 text-[#304342]">{typeMeta(resolveType(selected)).label}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">الحالة</div><div className="mt-1 text-sm leading-7 text-[#304342]">{statusMeta(selected.status).label}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3"><div className="text-xs font-bold text-[#016564]">التاريخ</div><div className="mt-1 text-sm leading-7 text-[#304342]">{formatDateTime(selected.createdAt)}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">العنوان</div><div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.title}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">الوصف</div><div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.description || '—'}</div></div><div className="rounded-[18px] border border-[#e7ebea] bg-white px-4 py-3 sm:col-span-2"><div className="text-xs font-bold text-[#016564]">مقدم الطلب</div><div className="mt-1 break-words text-sm leading-7 text-[#304342]">{selected.requester?.fullName || '—'}{selected.requester?.department ? ` — ${selected.requester.department}` : ''}</div></div></div>{canManage && (selected.status==='PENDING' || selected.status==='UNDER_REVIEW') ? <div className="space-y-3 rounded-[20px] border border-[#e7ebea] bg-[#f8fbfb] p-4"><div className="text-sm font-bold text-[#016564]">قرار المدير</div><textarea value={adminNotes} onChange={(e)=>setAdminNotes(e.target.value)} rows={4} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10" placeholder="اكتب ملاحظة القرار أو التوجيه" /><div className="flex flex-col gap-2 sm:flex-row sm:justify-end"><Button variant="danger" className="w-full sm:w-auto" loading={processing} onClick={()=>handleDecision('reject')}>رفض الطلب</Button><Button className="w-full sm:w-auto" loading={processing} onClick={()=>handleDecision('approve')}>اعتماد الطلب</Button></div></div> : null}<div className="flex flex-col gap-2 sm:flex-row sm:justify-end">{selected.linkedDraftId && canManage ? <Button className="w-full sm:w-auto" onClick={()=>router.push('/email-drafts')}>فتح المراسلات الخارجية</Button> : null}<Button variant="ghost" onClick={()=>setSelected(null)} className="w-full sm:w-auto">إغلاق</Button></div></div> : null}
      </Modal>
    </div>;
}
