'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { broadcastNotification, createNotification } from '@/lib/notifications';

type ReturnStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ItemCondition = 'GOOD' | 'PARTIAL_DAMAGE' | 'TOTAL_DAMAGE';

type ReturnItem = {
  id: string;
  code: string;
  requesterId?: string;
  status: ReturnStatus;
  conditionNote?: string | null;
  returnType?: ItemCondition | null;
  damageDetails?: string | null;
  damageImages?: string | null;
  declarationAck?: boolean;
  rejectionReason?: string | null;
  receivedType?: ItemCondition | null;
  receivedNotes?: string | null;
  receivedImages?: string | null;
  createdAt?: string;
  processedAt?: string | null;
  custody?: {
    id: string;
    quantity?: number;
    user?: {
      fullName?: string;
    };
    item?: {
      name?: string;
      code?: string;
    };
  };
};

type CustodyOption = {
  id: string;
  quantity: number;
  status: string;
  item?: {
    name?: string;
    code?: string;
  };
};

function conditionLabel(condition?: ItemCondition | null) {
  if (condition === 'GOOD') return 'سليمة';
  if (condition === 'PARTIAL_DAMAGE') return 'غير سليمة - تلف جزئي';
  if (condition === 'TOTAL_DAMAGE') return 'غير سليمة - تلف كلي';
  return '-';
}

function statusBadge(ret: ReturnItem) {
  if (ret.status === 'APPROVED') {
    if (ret.receivedType === 'GOOD') {
      return <Badge variant="success">تم الاستلام والتوثيق - سليمة</Badge>;
    }

    if (ret.receivedType === 'PARTIAL_DAMAGE') {
      return <Badge variant="warning">تم الاستلام والتوثيق - غير سليمة جزئيًا</Badge>;
    }

    if (ret.receivedType === 'TOTAL_DAMAGE') {
      return <Badge variant="danger">تم الاستلام والتوثيق - غير سليمة كليًا</Badge>;
    }

    return <Badge variant="success">تم الإغلاق</Badge>;
  }

  if (ret.status === 'REJECTED') {
    return <Badge variant="danger">مرفوض</Badge>;
  }

  return <Badge variant="warning">بانتظار الاستلام والتوثيق</Badge>;
}

export default function ReturnsPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const role = (user?.role || '').toLowerCase();

  const isEmployee = role === 'user';
  const canProcessReturns = role === 'warehouse' || role === 'manager';

  const [returns, setReturns] = useState<ReturnItem[]>([]);
  const [custodies, setCustodies] = useState<CustodyOption[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);

  const [receivedType, setReceivedType] = useState<ItemCondition>('GOOD');
  const [receivedNotes, setReceivedNotes] = useState('');
  const [receivedImages, setReceivedImages] = useState<File[]>([]);

  const [custodyId, setCustodyId] = useState('');
  const [reportedCondition, setReportedCondition] = useState<ItemCondition>('GOOD');
  const [conditionNote, setConditionNote] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [declarationAck, setDeclarationAck] = useState(false);

  useEffect(() => {
    fetchReturns();
    if (isEmployee) fetchCustodies();
  }, [isEmployee]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isEmployee) {
      setIsCreateOpen(true);
    }
  }, [searchParams, isEmployee]);

  const fetchReturns = async () => {
    const res = await fetch('/api/returns', { cache: 'no-store' });
    const data = await res.json();
    setReturns(data.data || data || []);
  };

  const fetchCustodies = async () => {
    const res = await fetch('/api/custody', { cache: 'no-store' });
    const data = await res.json();
    const activeCustodies = (data.data || []).filter(
      (item: CustodyOption) => item.status === 'ACTIVE'
    );
    setCustodies(activeCustodies);
  };

  const stats = useMemo(() => {
    return {
      total: returns.length,
      pending: returns.filter((r) => r.status === 'PENDING').length,
      good: returns.filter(
        (r) => r.status === 'APPROVED' && r.receivedType === 'GOOD'
      ).length,
      damaged: returns.filter(
        (r) =>
          r.status === 'APPROVED' &&
          (r.receivedType === 'PARTIAL_DAMAGE' || r.receivedType === 'TOTAL_DAMAGE')
      ).length,
    };
  }, [returns]);

  const resetCreateForm = () => {
    setCustodyId('');
    setReportedCondition('GOOD');
    setConditionNote('');
    setAttachments([]);
    setDeclarationAck(false);
  };

  const handleCloseCreateModal = () => {
    handleCloseCreateModal();

    if (searchParams.get('new') === '1') {
      router.replace('/returns');
    }
  };

  const resetProcessForm = () => {
    setSelectedReturn(null);
    setReceivedType('GOOD');
    setReceivedNotes('');
    setReceivedImages([]);
  };

  const handleCreateReturn = async (e: React.FormEvent) => {
    e.preventDefault();

    const uploadedNames = attachments.map((file) => file.name).join(' | ');

    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        custodyId,
        notes: conditionNote,
        returnType: reportedCondition,
        damageDetails: reportedCondition === 'GOOD' ? '' : conditionNote,
        damageImages: uploadedNames,
        declarationAck,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'تعذر إنشاء طلب الإرجاع');
      return;
    }

    if (user?.id) {
      createNotification({
        userId: user.id,
        kind: 'notification',
        severity: 'info',
        title: 'تم تسجيل طلب الإرجاع',
        message: `تم تسجيل طلب الإرجاع ${data?.code || ''} وهو الآن بانتظار الاستلام والتوثيق.`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: data?.id || null,
        dedupeKey: `return-created-user-${data?.id || custodyId}`,
      });
    }

    broadcastNotification({
      roles: ['manager', 'warehouse'],
      kind: 'alert',
      severity: 'action',
      title: 'طلب إرجاع جديد',
      message: `تم رفع طلب إرجاع جديد ${data?.code || ''} ويحتاج الاستلام والتوثيق.`,
      link: '/returns',
      entityType: 'RETURN',
      entityId: data?.id || null,
      dedupeKey: `return-created-admin-${data?.id || custodyId}`,
    });

    handleCloseCreateModal();
    fetchReturns();
    fetchCustodies();
  };

  const handleApproveReturn = async () => {
    if (!selectedReturn) return;

    const uploadedNames = receivedImages.map((file) => file.name).join(' | ');

    const res = await fetch('/api/returns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnId: selectedReturn.id,
        action: 'approve',
        receivedType,
        receivedNotes,
        receivedImages: uploadedNames,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'تعذر حفظ الاستلام والإغلاق');
      return;
    }

    const requesterId = (selectedReturn as any)?.requesterId || (data as any)?.requesterId || (selectedReturn as any)?.userId;

    if (requesterId) {
      createNotification({
        userId: requesterId,
        kind: 'notification',
        severity: receivedType === 'GOOD' ? 'info' : 'action',
        title: 'تم استلام المادة وتوثيق حالتها',
        message:
          receivedType === 'GOOD'
            ? `تم استلام المادة المرتبطة بطلب الإرجاع ${selectedReturn.code} وتوثيقها كحالة سليمة.`
            : `تم استلام المادة المرتبطة بطلب الإرجاع ${selectedReturn.code} وتوثيقها كحالة غير سليمة.`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: selectedReturn.id,
        dedupeKey: `return-approved-user-${selectedReturn.id}`,
      });
    }

    if (receivedType !== 'GOOD') {
      broadcastNotification({
        roles: ['manager', 'warehouse'],
        kind: 'alert',
        severity: 'critical',
        title: 'مادة مستلمة بحالة غير سليمة',
        message: `تم استلام المادة في طلب الإرجاع ${selectedReturn.code} وتوثيقها كحالة غير سليمة.`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: selectedReturn.id,
        dedupeKey: `return-damaged-${selectedReturn.id}`,
      });
    }

    resetProcessForm();
    fetchReturns();
  };

  const handleRejectReturn = async () => {
    if (!selectedReturn) return;

    const res = await fetch('/api/returns', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        returnId: selectedReturn.id,
        action: 'reject',
        reason: receivedNotes || 'تم رفض طلب الإرجاع',
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'تعذر رفض طلب الإرجاع');
      return;
    }

    const requesterId = (selectedReturn as any)?.requesterId || (data as any)?.requesterId || (selectedReturn as any)?.userId;

    if (requesterId) {
      createNotification({
        userId: requesterId,
        kind: 'notification',
        severity: 'action',
        title: 'تم رفض طلب الإرجاع',
        message: `تم رفض طلب الإرجاع ${selectedReturn.code}${receivedNotes ? ` بسبب: ${receivedNotes}` : '.'}`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: selectedReturn.id,
        dedupeKey: `return-rejected-${selectedReturn.id}`,
      });
    }

    resetProcessForm();
    fetchReturns();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-[1.25] text-primary">
              {isEmployee ? 'طلبات الإرجاع' : 'الاستلام والإغلاق'}
            </h1>
            <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
              {isEmployee
                ? 'ارفع طلب إرجاع للعهدة الشخصية مع توضيح حالة المادة وإرفاق الصور عند الحاجة.'
                : 'استلام المواد الراجعة وتوثيق حالتها وإغلاق الطلبات بشكل موحد للمدير ومسؤول المخزن.'}
            </p>
          </div>

          {isEmployee ? (
            <Button onClick={() => setIsCreateOpen(true)}>طلب إرجاع جديد</Button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
            <p className="text-[13px] text-slate-600">إجمالي الطلبات</p>
            <p className="mt-2 text-[32px] leading-none text-slate-900">{stats.total}</p>
          </Card>

          <Card className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] text-amber-700">بانتظار الاستلام والتوثيق</p>
            <p className="mt-2 text-[32px] leading-none text-slate-900">{stats.pending}</p>
          </Card>

          <Card className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[13px] text-emerald-700">أُغلقت سليمة</p>
            <p className="mt-2 text-[32px] leading-none text-slate-900">{stats.good}</p>
          </Card>

          <Card className="rounded-[22px] border border-red-200 bg-red-50 p-4">
            <p className="text-[13px] text-red-700">أُغلقت غير سليمة</p>
            <p className="mt-2 text-[32px] leading-none text-slate-900">{stats.damaged}</p>
          </Card>
        </div>
      </div>

      <div className="space-y-4">
        {returns.length === 0 ? (
          <Card className="rounded-[28px] p-8 text-center text-slate-500">
            لا توجد طلبات إرجاع حالياً
          </Card>
        ) : (
          returns.map((ret) => (
            <Card key={ret.id} className="rounded-[28px] border border-surface-border p-5 shadow-soft">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {statusBadge(ret)}
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-700">
                      الحالة المبلّغ عنها: {conditionLabel(ret.returnType)}
                    </span>

                    {ret.status === 'APPROVED' ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] leading-none text-emerald-700">
                        الحالة الموثقة عند الاستلام: {conditionLabel(ret.receivedType)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-[20px] leading-8 text-primary">{ret.code}</h3>

                  <div className="mt-2 grid gap-2 text-[13px] leading-7 text-slate-600 md:grid-cols-2">
                    <div>
                      المادة: <span className="text-slate-900">{ret.custody?.item?.name || '-'}</span>
                    </div>
                    <div>
                      المستخدم: <span className="text-slate-900">{ret.custody?.user?.fullName || '-'}</span>
                    </div>
                    <div>
                      رقم المادة: <span className="text-slate-900">{ret.custody?.item?.code || '-'}</span>
                    </div>
                    <div>
                      تاريخ الطلب:{' '}
                      <span className="text-slate-900">
                        {ret.createdAt ? new Date(ret.createdAt).toLocaleDateString('ar-SA') : '-'}
                      </span>
                    </div>
                    <div>
                      تاريخ الاستلام والتوثيق:{' '}
                      <span className="text-slate-900">
                        {ret.processedAt ? new Date(ret.processedAt).toLocaleDateString('ar-SA') : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 rounded-[20px] border border-surface-border bg-slate-50 p-4 text-[13px] leading-7 text-slate-700">
                    <div>
                      ملاحظات طالب الإرجاع:{' '}
                      <span className="text-slate-900">
                        {ret.damageDetails || ret.conditionNote || '-'}
                      </span>
                    </div>

                    {ret.status === 'APPROVED' ? (
                      <div className="mt-2">
                        ملاحظات الاستلام والتوثيق:{' '}
                        <span className="text-slate-900">{ret.receivedNotes || '-'}</span>
                      </div>
                    ) : null}

                    {ret.status === 'REJECTED' ? (
                      <div className="mt-2">
                        سبب الرفض:{' '}
                        <span className="text-slate-900">{ret.rejectionReason || '-'}</span>
                      </div>
                    ) : null}
                  </div>

                  {ret.damageImages ? (
                    <div className="mt-3 text-[12px] leading-6 text-slate-500">
                      صور مرفقة من طالب الإرجاع: {ret.damageImages}
                    </div>
                  ) : null}

                  {ret.receivedImages ? (
                    <div className="mt-2 text-[12px] leading-6 text-slate-500">
                      صور مرفقة عند الاستلام: {ret.receivedImages}
                    </div>
                  ) : null}
                </div>

                {canProcessReturns && ret.status === 'PENDING' ? (
                  <div className="flex shrink-0 gap-2">
                    <Button
                      onClick={() => {
                        setSelectedReturn(ret);
                        setReceivedType(ret.returnType || 'GOOD');
                        setReceivedNotes('');
                        setReceivedImages([]);
                      }}
                    >
                      استلام وتوثيق الحالة
                    </Button>
                  </div>
                ) : null}
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal
        isOpen={isCreateOpen}
        onClose={() => {
          setIsCreateOpen(false);
          resetCreateForm();
        }}
        title="طلب إرجاع جديد"
      >
        <form onSubmit={handleCreateReturn} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-primary">العهدة المطلوب إرجاعها</label>
            <select
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              value={custodyId}
              onChange={(e) => setCustodyId(e.target.value)}
              required
            >
              <option value="">اختر المادة</option>
              {custodies.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item?.name || '-'} {item.item?.code ? `- ${item.item.code}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">حالة المادة عند الإرجاع</label>
            <select
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              value={reportedCondition}
              onChange={(e) => setReportedCondition(e.target.value as ItemCondition)}
              required
            >
              <option value="GOOD">سليمة</option>
              <option value="PARTIAL_DAMAGE">غير سليمة - تلف جزئي</option>
              <option value="TOTAL_DAMAGE">غير سليمة - تلف كلي</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">وصف الحالة / ملاحظات</label>
            <textarea
              rows={4}
              className="w-full rounded-xl border border-surface-border p-3"
              value={conditionNote}
              onChange={(e) => setConditionNote(e.target.value)}
              placeholder="مثال: يوجد خدش بسيط في الجهة اليمنى"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">إرفاق صور الحالة</label>
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => setAttachments(Array.from(e.target.files || []))}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
            {attachments.length > 0 ? (
              <div className="mt-2 text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {attachments.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-surface-border p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4"
              checked={declarationAck}
              onChange={(e) => setDeclarationAck(e.target.checked)}
              required
            />
            <span>أقر بصحة المعلومات، وأن المادة ستُسلّم للاستلام والتوثيق حسب حالتها الفعلية.</span>
          </label>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsCreateOpen(false);
                resetCreateForm();
              }}
            >
              إلغاء
            </Button>
            <Button type="submit">إرسال طلب الإرجاع</Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedReturn}
        onClose={resetProcessForm}
        title="استلام وتوثيق حالة المادة"
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-surface-border bg-slate-50 p-4 text-[14px] leading-7 text-slate-700">
            المادة:{' '}
            <span className="text-slate-900">{selectedReturn?.custody?.item?.name || '-'}</span>
            <br />
            الحالة المبلّغ عنها:{' '}
            <span className="text-slate-900">{conditionLabel(selectedReturn?.returnType)}</span>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">الحالة الموثقة عند الاستلام</label>
            <select
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              value={receivedType}
              onChange={(e) => setReceivedType(e.target.value as ItemCondition)}
            >
              <option value="GOOD">سليمة</option>
              <option value="PARTIAL_DAMAGE">غير سليمة - تلف جزئي</option>
              <option value="TOTAL_DAMAGE">غير سليمة - تلف كلي</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">ملاحظات الاستلام والتوثيق</label>
            <textarea
              rows={5}
              className="w-full rounded-xl border border-surface-border p-3"
              value={receivedNotes}
              onChange={(e) => setReceivedNotes(e.target.value)}
              placeholder="أضف الوصف الفعلي لحالة المادة عند الاستلام"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">إرفاق صور عند الاستلام</label>
            <input
              type="file"
              multiple
              accept="image/*"
              capture="environment"
              onChange={(e) => setReceivedImages(Array.from(e.target.files || []))}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            />
            {receivedImages.length > 0 ? (
              <div className="mt-2 text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {receivedImages.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={resetProcessForm}>
              إلغاء
            </Button>
            <Button type="button" variant="danger" onClick={handleRejectReturn}>
              رفض الطلب
            </Button>
            <Button type="button" onClick={handleApproveReturn}>
              حفظ الاستلام والإغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}