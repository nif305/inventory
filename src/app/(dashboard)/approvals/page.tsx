'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type RequestRecord = {
  id: string;
  code: string;
  department: string;
  purpose: string;
  createdAt?: string;
  requester?: {
    fullName?: string;
  };
  items?: Array<{
    id: string;
    quantity: number;
    item?: {
      name?: string;
      availableQty?: number;
    };
  }>;
};

function formatDate(date?: string) {
  if (!date) return '—';
  return new Intl.DateTimeFormat('ar-SA', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(date));
}

export default function ApprovalsPage() {
  const { user } = useAuth();
  const [pendingRequests, setPendingRequests] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/requests?status=PENDING', { cache: 'no-store' });
      const data = await res.json();
      setPendingRequests(Array.isArray(data?.data) ? data.data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const stats = useMemo(() => pendingRequests.length, [pendingRequests]);

  const handleAction = async (
    id: string,
    action: 'approve' | 'reject' | 'approve_and_issue'
  ) => {
    setProcessingId(id);
    try {
      if (action === 'approve_and_issue') {
        const approveRes = await fetch(`/api/requests/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'approve',
          }),
        });

        if (!approveRes.ok) {
          await fetchPending();
          return;
        }

        const issueRes = await fetch(`/api/requests/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'issue',
          }),
        });

        if (issueRes.ok) {
          await fetchPending();
        }

        return;
      }

      const res = await fetch(`/api/requests/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          reason: action === 'reject' ? 'تم الرفض من الإدارة' : undefined,
        }),
      });

      if (res.ok) {
        await fetchPending();
      }
    } finally {
      setProcessingId(null);
    }
  };

  if (user?.role !== 'manager') {
    return <div className="p-8 text-center text-red-600">غير مصرح لك بالوصول لهذه الصفحة</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-primary">مركز الاعتمادات</h1>
          <p className="text-sm text-slate-500">الطلبات بانتظار موافقتك</p>
        </div>

        <span className="inline-flex rounded-full border border-[#d0b284]/40 bg-[#d0b284]/15 px-3 py-1 text-sm font-bold text-[#8a6a28]">
          {stats} طلب معلق
        </span>
      </div>

      {loading ? (
        <Card className="p-8 text-center">جارِ التحميل...</Card>
      ) : pendingRequests.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">لا توجد طلبات معلقة حالياً</Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {pendingRequests.map((req) => (
            <Card key={req.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-lg font-bold text-[#016564]">{req.code}</div>
                  <div className="text-xs text-slate-500">{req.department}</div>
                </div>

                <span className="inline-flex rounded-full border border-[#d0b284]/40 bg-[#d0b284]/15 px-3 py-1 text-xs font-bold text-[#8a6a28]">
                  بانتظار الاعتماد
                </span>
              </div>

              <div className="space-y-1 text-sm">
                <div className="font-semibold text-slate-800">
                  {req.requester?.fullName || 'غير معروف'}
                </div>
                <div className="text-slate-600">{req.purpose}</div>
                <div className="text-xs text-slate-400">{formatDate(req.createdAt)}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-3 text-sm">
                <div className="mb-2 font-semibold text-slate-700">الأصناف</div>
                <ul className="space-y-1 text-slate-600">
                  {req.items?.map((it) => (
                    <li key={it.id}>
                      {it.item?.name || 'صنف'} × {it.quantity}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-1 gap-2 lg:grid-cols-3">
                <Button
                  className="w-full"
                  onClick={() => handleAction(req.id, 'approve')}
                  disabled={processingId === req.id}
                >
                  اعتماد
                </Button>

                <Button
                  className="w-full"
                  variant="secondary"
                  onClick={() => handleAction(req.id, 'approve_and_issue')}
                  disabled={processingId === req.id}
                >
                  اعتماد وصرف
                </Button>

                <Button
                  variant="danger"
                  className="w-full"
                  onClick={() => handleAction(req.id, 'reject')}
                  disabled={processingId === req.id}
                >
                  رفض
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}