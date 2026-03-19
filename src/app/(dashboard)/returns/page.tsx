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
type ReturnSourceType = 'CUSTODY' | 'REQUEST_ITEM';

type ReturnItem = {
  id: string;
  code: string;
  requesterId?: string;
  status: ReturnStatus;
  sourceType?: ReturnSourceType;
  quantity?: number;
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
      type?: string;
    };
  } | null;
  requestItem?: {
    id: string;
    quantity?: number;
    item?: {
      name?: string;
      code?: string;
      type?: string;
    };
    request?: {
      code?: string;
      purpose?: string;
    };
  } | null;
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

type RequestReturnOption = {
  id: string;
  quantity: number;
  item?: {
    name?: string;
    code?: string;
    type?: string;
  };
  request?: {
    code?: string;
    purpose?: string;
    status?: string;
  };
  returnRequests?: Array<{
    id: string;
    quantity?: number;
    status?: ReturnStatus;
  }>;
};

function conditionLabel(condition?: ItemCondition | null) {
  if (condition === 'GOOD') return 'سليمة';
  if (condition === 'PARTIAL_DAMAGE') return 'غير سليمة - تلف جزئي';
  if (condition === 'TOTAL_DAMAGE') return 'غير سليمة - تلف كلي';
  return '-';
}

function sourceTypeLabel(sourceType?: ReturnSourceType) {
  if (sourceType === 'REQUEST_ITEM') return 'فائض مواد مستهلكة';
  return 'عهدة مسترجعة';
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

function formatDate(value?: string | null) {
  if (!value) return '-';

  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(value));
  } catch {
    return '-';
  }
}

function getReturnItemName(ret: ReturnItem) {
  return ret.custody?.item?.name || ret.requestItem?.item?.name || '-';
}

function getReturnItemCode(ret: ReturnItem) {
  return ret.custody?.item?.code || ret.requestItem?.item?.code || '-';
}

function getReturnRequesterName(ret: ReturnItem) {
  return ret.custody?.user?.fullName || '-';
}

function getReturnQuantity(ret: ReturnItem) {
  if (ret.sourceType === 'REQUEST_ITEM') return ret.quantity || 0;
  return ret.custody?.quantity || ret.quantity || 0;
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
  const [requestItems, setRequestItems] = useState<RequestReturnOption[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState<ReturnItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [pageError, setPageError] = useState('');

  const [receivedType, setReceivedType] = useState<ItemCondition>('GOOD');
  const [receivedNotes, setReceivedNotes] = useState('');
  const [receivedImages, setReceivedImages] = useState<File[]>([]);

  const [returnMode, setReturnMode] = useState<'CUSTODY' | 'REQUEST_ITEM'>('CUSTODY');
  const [custodyId, setCustodyId] = useState('');
  const [requestItemId, setRequestItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState<number>(1);
  const [reportedCondition, setReportedCondition] = useState<ItemCondition>('GOOD');
  const [conditionNote, setConditionNote] = useState('');
  const [attachments, setAttachments] = useState<File[]>([]);
  const [declarationAck, setDeclarationAck] = useState(false);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setPageError('');

      try {
        await Promise.all([
          fetchReturns(),
          isEmployee ? fetchCustodies() : Promise.resolve(),
          isEmployee ? fetchReturnableRequestItems() : Promise.resolve(),
        ]);
      } catch (error: any) {
        setPageError(error?.message || 'تعذر تحميل بيانات صفحة الإرجاع');
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, [isEmployee]);

  useEffect(() => {
    if (searchParams.get('new') === '1' && isEmployee) {
      setIsCreateOpen(true);
    }
  }, [searchParams, isEmployee]);

  const fetchReturns = async () => {
    const res = await fetch('/api/returns', { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'تعذر جلب طلبات الإرجاع');
    }

    setReturns(data.data || []);
  };

  const fetchCustodies = async () => {
    const res = await fetch('/api/custody', { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'تعذر جلب العهد');
    }

    const activeCustodies = (data.data || []).filter(
      (item: CustodyOption) => item.status === 'ACTIVE'
    );
    setCustodies(activeCustodies);
  };

  const fetchReturnableRequestItems = async () => {
    const res = await fetch('/api/requests?mine=1', { cache: 'no-store' });
    const data = await res.json();

    if (!res.ok) {
      throw new Error(data?.error || 'تعذر جلب طلبات المواد');
    }

    const requests = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];

    const eligibleItems: RequestReturnOption[] = requests.flatMap((request: any) => {
      const items = Array.isArray(request?.items) ? request.items : [];

      return items
        .filter((item: any) => item?.item?.type === 'CONSUMABLE' && request?.status === 'ISSUED')
        .map((item: any) => ({
          id: item.id,
          quantity: Number(item.quantity || 0),
          item: item.item,
          request: {
            code: request.code,
            purpose: request.purpose,
            status: request.status,
          },
          returnRequests: Array.isArray(item.returnRequests) ? item.returnRequests : [],
        }))
        .filter((item: RequestReturnOption) => {
          const alreadyReturned = (item.returnRequests || [])
            .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
            .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

          return item.quantity - alreadyReturned > 0;
        });
    });

    setRequestItems(eligibleItems);
  };

  const selectedRequestItem = useMemo(() => {
    return requestItems.find((item) => item.id === requestItemId) || null;
  }, [requestItems, requestItemId]);

  const availableRequestReturnQty = useMemo(() => {
    if (!selectedRequestItem) return 0;

    const alreadyReturned = (selectedRequestItem.returnRequests || [])
      .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
      .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

    return Math.max(0, Number(selectedRequestItem.quantity || 0) - alreadyReturned);
  }, [selectedRequestItem]);

  const stats = useMemo(() => {
    return {
      total: returns.length,
      pending: returns.filter((r) => r.status === 'PENDING').length,
      good: returns.filter((r) => r.status === 'APPROVED' && r.receivedType === 'GOOD').length,
      damaged: returns.filter(
        (r) =>
          r.status === 'APPROVED' &&
          (r.receivedType === 'PARTIAL_DAMAGE' || r.receivedType === 'TOTAL_DAMAGE')
      ).length,
    };
  }, [returns]);

  const resetCreateForm = () => {
    setReturnMode('CUSTODY');
    setCustodyId('');
    setRequestItemId('');
    setReturnQuantity(1);
    setReportedCondition('GOOD');
    setConditionNote('');
    setAttachments([]);
    setDeclarationAck(false);
  };

  const closeCreateModal = () => {
    setIsCreateOpen(false);
    resetCreateForm();

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

    if (returnMode === 'CUSTODY' && !custodyId) {
      alert('اختر العهدة المطلوب إرجاعها');
      return;
    }

    if (returnMode === 'REQUEST_ITEM') {
      if (!requestItemId) {
        alert('اختر بند الطلب المطلوب إعادة الفائض منه');
        return;
      }

      if (!returnQuantity || returnQuantity <= 0) {
        alert('أدخل كمية صحيحة للإرجاع');
        return;
      }

      if (returnQuantity > availableRequestReturnQty) {
        alert('كمية الإرجاع تتجاوز الكمية المتاحة');
        return;
      }
    }

    const uploadedNames = attachments.map((file) => file.name).join(' | ');

    const payload =
      returnMode === 'CUSTODY'
        ? {
            custodyId,
            notes: conditionNote,
            returnType: reportedCondition,
            damageDetails: reportedCondition === 'GOOD' ? '' : conditionNote,
            damageImages: uploadedNames,
            declarationAck,
          }
        : {
            requestItemId,
            quantity: returnQuantity,
            notes: conditionNote,
            returnType: reportedCondition,
            damageDetails: reportedCondition === 'GOOD' ? '' : conditionNote,
            damageImages: uploadedNames,
            declarationAck,
          };

    const res = await fetch('/api/returns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
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
        dedupeKey: `return-created-user-${data?.id || custodyId || requestItemId}`,
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
      dedupeKey: `return-created-admin-${data?.id || custodyId || requestItemId}`,
    });

    closeCreateModal();
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
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

    const requesterId = (selectedReturn as any)?.requesterId || (data as any)?.requesterId;

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
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
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

    const requesterId = (selectedReturn as any)?.requesterId || (data as any)?.requesterId;

    if (requesterId) {
      createNotification({
        userId: requesterId,
        kind: 'notification',
        severity: 'action',
        title: 'تم رفض طلب الإرجاع',
        message: `تم رفض طلب الإرجاع ${selectedReturn.code}${
          receivedNotes ? ` بسبب: ${receivedNotes}` : '.'
        }`,
        link: '/returns',
        entityType: 'RETURN',
        entityId: selectedReturn.id,
        dedupeKey: `return-rejected-${selectedReturn.id}`,
      });
    }

    resetProcessForm();
    await Promise.all([fetchReturns(), fetchCustodies(), fetchReturnableRequestItems()]);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-[24px] border border-surface-border bg-white p-4 shadow-soft sm:rounded-[28px] sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] leading-[1.25] text-primary sm:text-[30px]">
              {isEmployee ? 'طلبات الإرجاع' : 'الاستلام والإغلاق'}
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-surface-subtle sm:text-[14px]">
              {isEmployee
                ? 'إرجاع العهد المسترجعة أو رفع طلب إعادة فائض المواد الاستهلاكية من الطلبات المصروفة.'
                : 'استلام المواد الراجعة وتوثيق حالتها وإغلاق الطلبات بشكل موحد للمدير ومسؤول المخزن.'}
            </p>
          </div>

          {isEmployee ? (
            <Button onClick={() => setIsCreateOpen(true)} className="w-full sm:w-auto">
              طلب إرجاع جديد
            </Button>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-4 sm:mt-5 sm:gap-4">
          <Card className="rounded-[20px] border border-slate-200 bg-slate-50 p-3 sm:rounded-[22px] sm:p-4">
            <p className="text-[12px] text-slate-600 sm:text-[13px]">إجمالي الطلبات</p>
            <p className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.total}
            </p>
          </Card>

          <Card className="rounded-[20px] border border-amber-200 bg-amber-50 p-3 sm:rounded-[22px] sm:p-4">
            <p className="text-[12px] text-amber-700 sm:text-[13px]">بانتظار الاستلام والتوثيق</p>
            <p className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.pending}
            </p>
          </Card>

          <Card className="rounded-[20px] border border-emerald-200 bg-emerald-50 p-3 sm:rounded-[22px] sm:p-4">
            <p className="text-[12px] text-emerald-700 sm:text-[13px]">أُغلقت سليمة</p>
            <p className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.good}
            </p>
          </Card>

          <Card className="rounded-[20px] border border-red-200 bg-red-50 p-3 sm:rounded-[22px] sm:p-4">
            <p className="text-[12px] text-red-700 sm:text-[13px]">أُغلقت غير سليمة</p>
            <p className="mt-2 text-[24px] leading-none text-slate-900 sm:text-[32px]">
              {stats.damaged}
            </p>
          </Card>
        </div>
      </div>

      {pageError ? (
        <Card className="rounded-[24px] border border-red-200 bg-red-50 p-4 text-sm text-red-700 sm:rounded-[28px]">
          {pageError}
        </Card>
      ) : null}

      <div className="space-y-3 sm:space-y-4">
        {isLoading ? (
          <Card className="rounded-[24px] p-8 text-center text-slate-500 sm:rounded-[28px]">
            جارٍ تحميل طلبات الإرجاع...
          </Card>
        ) : returns.length === 0 ? (
          <Card className="rounded-[24px] p-8 text-center text-slate-500 sm:rounded-[28px]">
            لا توجد طلبات إرجاع حالياً
          </Card>
        ) : (
          returns.map((ret) => (
            <Card
              key={ret.id}
              className="rounded-[24px] border border-surface-border p-4 shadow-soft sm:rounded-[28px] sm:p-5"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    {statusBadge(ret)}

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-700">
                      المسار: {sourceTypeLabel(ret.sourceType)}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] leading-none text-slate-700">
                      الحالة المبلّغ عنها: {conditionLabel(ret.returnType)}
                    </span>

                    {ret.status === 'APPROVED' ? (
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] leading-none text-emerald-700">
                        الحالة الموثقة عند الاستلام: {conditionLabel(ret.receivedType)}
                      </span>
                    ) : null}
                  </div>

                  <h3 className="text-[18px] leading-8 text-primary sm:text-[20px]">{ret.code}</h3>

                  <div className="mt-3 grid gap-2 rounded-[20px] bg-slate-50 p-3 text-[13px] leading-7 text-slate-600 md:grid-cols-2 sm:p-4">
                    <div>
                      المادة: <span className="text-slate-900">{getReturnItemName(ret)}</span>
                    </div>
                    <div>
                      المستخدم:{' '}
                      <span className="text-slate-900">{getReturnRequesterName(ret)}</span>
                    </div>
                    <div>
                      رقم المادة:{' '}
                      <span className="text-slate-900">{getReturnItemCode(ret)}</span>
                    </div>
                    <div>
                      الكمية: <span className="text-slate-900">{getReturnQuantity(ret)}</span>
                    </div>
                    <div>
                      تاريخ الطلب: <span className="text-slate-900">{formatDate(ret.createdAt)}</span>
                    </div>
                    <div>
                      تاريخ الاستلام والتوثيق:{' '}
                      <span className="text-slate-900">{formatDate(ret.processedAt)}</span>
                    </div>
                    {ret.requestItem?.request?.code ? (
                      <div>
                        رقم الطلب: <span className="text-slate-900">{ret.requestItem.request.code}</span>
                      </div>
                    ) : null}
                    {ret.requestItem?.request?.purpose ? (
                      <div>
                        الغرض: <span className="text-slate-900">{ret.requestItem.request.purpose}</span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 rounded-[20px] border border-surface-border bg-white p-3 text-[13px] leading-7 text-slate-700 sm:p-4">
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
                    <div className="mt-3 break-words text-[12px] leading-6 text-slate-500">
                      صور مرفقة من طالب الإرجاع: {ret.damageImages}
                    </div>
                  ) : null}

                  {ret.receivedImages ? (
                    <div className="mt-2 break-words text-[12px] leading-6 text-slate-500">
                      صور مرفقة عند الاستلام: {ret.receivedImages}
                    </div>
                  ) : null}
                </div>

                {canProcessReturns && ret.status === 'PENDING' ? (
                  <div className="flex w-full shrink-0 flex-col gap-2 lg:w-auto">
                    <Button
                      className="w-full lg:w-auto"
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

      <Modal isOpen={isCreateOpen} onClose={closeCreateModal} title="طلب إرجاع جديد" size="lg">
        <form onSubmit={handleCreateReturn} className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-primary">نوع طلب الإرجاع</label>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setReturnMode('CUSTODY');
                  setRequestItemId('');
                  setReturnQuantity(1);
                }}
                className={`rounded-xl border p-3 text-right text-sm transition ${
                  returnMode === 'CUSTODY'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-surface-border bg-white text-slate-700'
                }`}
              >
                <div className="font-semibold">إرجاع عهدة مسترجعة</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-500">
                  خاص بالمواد المسترجعة الموجودة في عهدتي
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setReturnMode('REQUEST_ITEM');
                  setCustodyId('');
                }}
                className={`rounded-xl border p-3 text-right text-sm transition ${
                  returnMode === 'REQUEST_ITEM'
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-surface-border bg-white text-slate-700'
                }`}
              >
                <div className="font-semibold">إرجاع فائض مواد مستهلكة</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-500">
                  خاص بفائض المواد المصروفة مثل الأقلام الزائدة
                </div>
              </button>
            </div>
          </div>

          {returnMode === 'CUSTODY' ? (
            <div>
              <label className="mb-2 block text-sm text-primary">العهدة المطلوب إرجاعها</label>
              <select
                className="w-full rounded-xl border border-surface-border bg-white p-3"
                value={custodyId}
                onChange={(e) => setCustodyId(e.target.value)}
                required={returnMode === 'CUSTODY'}
              >
                <option value="">اختر المادة</option>
                {custodies.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item?.name || '-'} {item.item?.code ? `- ${item.item.code}` : ''}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <>
              <div>
                <label className="mb-2 block text-sm text-primary">بند الطلب المطلوب إعادة فائضه</label>
                <select
                  className="w-full rounded-xl border border-surface-border bg-white p-3"
                  value={requestItemId}
                  onChange={(e) => {
                    setRequestItemId(e.target.value);
                    setReturnQuantity(1);
                  }}
                  required={returnMode === 'REQUEST_ITEM'}
                >
                  <option value="">اختر بند الطلب</option>
                  {requestItems.map((item) => {
                    const alreadyReturned = (item.returnRequests || [])
                      .filter((ret) => ret.status === 'PENDING' || ret.status === 'APPROVED')
                      .reduce((sum, ret) => sum + Number(ret.quantity || 0), 0);

                    const remaining = Math.max(0, Number(item.quantity || 0) - alreadyReturned);

                    return (
                      <option key={item.id} value={item.id}>
                        {item.item?.name || '-'}
                        {item.item?.code ? ` - ${item.item.code}` : ''}
                        {item.request?.code ? ` - طلب ${item.request.code}` : ''}
                        {` - المتبقي للإرجاع ${remaining}`}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm text-primary">كمية الفائض المراد إرجاعها</label>
                <input
                  type="number"
                  min={1}
                  max={availableRequestReturnQty || 1}
                  value={returnQuantity}
                  onChange={(e) => setReturnQuantity(Number(e.target.value || 1))}
                  className="w-full rounded-xl border border-surface-border bg-white p-3"
                  required={returnMode === 'REQUEST_ITEM'}
                />
                <div className="mt-2 text-[12px] leading-6 text-slate-500">
                  الكمية المتاحة للإرجاع: {availableRequestReturnQty}
                </div>
              </div>
            </>
          )}

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
              placeholder={
                returnMode === 'REQUEST_ITEM'
                  ? 'مثال: بقيت 10 أقلام لم تُستخدم وسيتم إرجاعها'
                  : 'مثال: يوجد خدش بسيط في الجهة اليمنى'
              }
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
              <div className="mt-2 break-words text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {attachments.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <label className="flex items-start gap-3 rounded-xl border border-surface-border p-3 text-sm leading-7 text-slate-700">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 shrink-0"
              checked={declarationAck}
              onChange={(e) => setDeclarationAck(e.target.checked)}
              required
            />
            <span>
              أقر بصحة المعلومات، وأن المواد ستُسلّم للاستلام والتوثيق حسب حالتها الفعلية.
            </span>
          </label>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={closeCreateModal}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button type="submit" className="w-full sm:w-auto">
              إرسال طلب الإرجاع
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={!!selectedReturn}
        onClose={resetProcessForm}
        title="استلام وتوثيق حالة المادة"
        size="lg"
      >
        <div className="space-y-4">
          <div className="rounded-[18px] border border-surface-border bg-slate-50 p-4 text-[14px] leading-7 text-slate-700">
            المسار: <span className="text-slate-900">{sourceTypeLabel(selectedReturn?.sourceType)}</span>
            <br />
            المادة: <span className="text-slate-900">{getReturnItemName(selectedReturn as ReturnItem)}</span>
            <br />
            الكمية: <span className="text-slate-900">{getReturnQuantity(selectedReturn as ReturnItem)}</span>
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
              <div className="mt-2 break-words text-[12px] leading-6 text-slate-500">
                الملفات المختارة: {receivedImages.map((file) => file.name).join(' ، ')}
              </div>
            ) : null}
          </div>

          <div className="flex flex-col-reverse justify-end gap-2 border-t pt-4 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={resetProcessForm}
              className="w-full sm:w-auto"
            >
              إلغاء
            </Button>
            <Button
              type="button"
              variant="danger"
              onClick={handleRejectReturn}
              className="w-full sm:w-auto"
            >
              رفض الطلب
            </Button>
            <Button type="button" onClick={handleApproveReturn} className="w-full sm:w-auto">
              حفظ الاستلام والإغلاق
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}