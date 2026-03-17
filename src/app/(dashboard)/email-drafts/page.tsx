'use client';
import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { DEPARTMENTS } from '@/lib/constants/departments';
export default function EmailDraftsPage() {
  const { user } = useAuth();
  const [approvedRequests, setApprovedRequests] = useState<any[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedDept, setSelectedDept] = useState<keyof typeof DEPARTMENTS | ''>('');
  const [generatedEmail, setGeneratedEmail] = useState<any>(null);
  useEffect(() => { setApprovedRequests([{ id: 'p1', code: 'PUR-2025-05', type: 'purchase', title: 'أجهزة كمبيوتر للمختبر' }, { id: 'm1', code: 'MNT-2025-02', type: 'maintenance', title: 'صيانة المكيف الرئيسي' }]); }, []);
  const handleGenerate = async () => {
    if (!selectedRequest || !selectedDept) { alert('الرجاء اختيار الطلب والقسم المستلم'); return; }
    const res = await fetch('/api/email-drafts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceType: selectedRequest.type, sourceId: selectedRequest.id, targetDept: selectedDept }) });
    setGeneratedEmail(await res.json());
  };
  const handleCopy = () => { if (!generatedEmail) return; navigator.clipboard.writeText(generatedEmail.body); alert('تم نسخ نص الرسالة!'); };
  if (user?.role !== 'manager') return <div className="p-8 text-center text-red-600">غير مصرح لك بالوصول</div>;
  return <div className="space-y-6"><h1 className="text-2xl font-bold text-primary">توليد المراسلات المؤسسية</h1><div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><Card className="p-6"><h3 className="mb-4 font-bold">1. اختر الطلب</h3><div className="mb-6 space-y-2">{approvedRequests.map((req) => <div key={req.id} onClick={() => setSelectedRequest(req)} className={`p-3 rounded-lg cursor-pointer border ${selectedRequest?.id === req.id ? 'border-primary bg-primary/5' : 'hover:bg-surface'}`}><p className="font-medium text-sm">{req.code}</p><p className="text-xs text-gray-500">{req.title}</p></div>)}</div><h3 className="mb-4 font-bold">2. اختر الجهة المستلمة</h3><select className="w-full form-input rounded-lg mb-4 border border-surface-border px-4 py-2" value={selectedDept} onChange={(e) => setSelectedDept(e.target.value as any)}><option value="" disabled>اختر القسم</option><option value="PROCUREMENT">إدارة المشتريات</option><option value="FINANCE">الإدارة المالية</option><option value="IT">مركز تقنية المعلومات</option><option value="SUPPORT_SERVICES">إدارة الخدمات المساندة</option></select><Button className="w-full" onClick={handleGenerate}>توليد المسودة</Button></Card><div className="lg:col-span-2"><Card className="p-6 h-full bg-gray-50 border-dashed">{generatedEmail ? <div className="space-y-4 h-full flex flex-col"><div className="flex justify-between items-center border-b pb-2 mb-2"><h3 className="font-bold text-primary">3. معاينة الرسالة</h3><Button size="sm" onClick={handleCopy}>نسخ النص</Button></div><div className="bg-white p-6 rounded-xl shadow-sm flex-1 overflow-auto border"><pre className="whitespace-pre-wrap text-right text-sm text-gray-800 leading-relaxed">{generatedEmail.body}</pre></div></div> : <div className="h-full flex items-center justify-center text-gray-400"><p>سيظهر هنا نص الرسالة الرسمي بعد التوليد</p></div>}</Card></div></div></div>;
}
