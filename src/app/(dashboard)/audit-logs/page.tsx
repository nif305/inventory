'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/context/AuthContext';

type ServerAuditRow = {
  id: string;
  source: 'SERVER';
  action: string;
  entity: string;
  entityId?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id?: string;
    fullName?: string;
    role?: string | null;
    email?: string | null;
  } | null;
};

type StoredMessage = {
  id: string;
  threadId: string;
  parentMessageId?: string | null;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  relatedType?: string | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
};

type StoredReturn = {
  id: string;
  custodyId: string;
  userId: string;
  returnType?: string | null;
  conditionNote?: string | null;
  damageDetails?: string | null;
  damageImages?: string | null;
  declarationAck?: boolean;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
};

type UnifiedAuditRow = {
  id: string;
  source: 'SERVER' | 'LOCAL';
  createdAt: string;
  actorName: string;
  actorRole: string;
  action: string;
  entity: string;
  entityId?: string | null;
  result: string;
  description: string;
  ipAddress?: string | null;
};

const MESSAGES_STORAGE_KEY = 'inventory_internal_messages';
const RETURNS_STORAGE_KEY = 'inventory_returns';

function loadLocal<T>(key: string): T[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatDate(value?: string) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return value;
  }
}

function roleLabel(role?: string | null) {
  if (role === 'manager' || role === 'MANAGER') return 'مدير';
  if (role === 'warehouse' || role === 'WAREHOUSE') return 'مسؤول مخزن';
  if (role === 'user' || role === 'USER') return 'موظف';
  return 'غير محدد';
}

function entityLabel(entity?: string | null) {
  if (entity === 'Request') return 'طلب مواد';
  if (entity === 'ReturnRequest') return 'طلب إرجاع';
  if (entity === 'InventoryItem') return 'مادة مخزنية';
  if (entity === 'MaintenanceRequest') return 'طلب صيانة';
  if (entity === 'Message') return 'مراسلة داخلية';
  return entity || '-';
}

function actionLabel(action?: string | null) {
  switch (action) {
    case 'CREATE_REQUEST':
      return 'إنشاء طلب';
    case 'APPROVE_REQUEST':
      return 'اعتماد طلب';
    case 'ISSUE_REQUEST':
      return 'صرف طلب';
    case 'CREATE_RETURN_REQUEST':
      return 'إنشاء طلب إرجاع';
    case 'APPROVE_RETURN_REQUEST':
      return 'استلام وتوثيق حالة المادة';
    case 'REJECT_RETURN_REQUEST':
      return 'رفض طلب إرجاع';
    case 'CREATE_INVENTORY':
      return 'إضافة مادة للمخزون';
    case 'UPDATE_INVENTORY':
      return 'تحديث مادة مخزنية';
    case 'DELETE_INVENTORY':
      return 'حذف مادة مخزنية';
    case 'ADJUST_STOCK':
      return 'تعديل كمية المخزون';
    case 'CREATE_MAINTENANCE':
      return 'إنشاء طلب صيانة';
    case 'SEND_MESSAGE':
      return 'إرسال رسالة داخلية';
    case 'REPLY_MESSAGE':
      return 'إرسال رد داخلي';
    case 'LOCAL_CREATE_RETURN_REQUEST':
      return 'إنشاء طلب إرجاع';
    default:
      return action || '-';
  }
}

function resultLabel(action?: string | null) {
  switch (action) {
    case 'APPROVE_REQUEST':
      return 'تم الاعتماد';
    case 'ISSUE_REQUEST':
      return 'تم الصرف';
    case 'APPROVE_RETURN_REQUEST':
      return 'تم الاستلام';
    case 'REJECT_RETURN_REQUEST':
      return 'تم الرفض';
    case 'CREATE_REQUEST':
    case 'CREATE_RETURN_REQUEST':
    case 'LOCAL_CREATE_RETURN_REQUEST':
    case 'CREATE_INVENTORY':
    case 'UPDATE_INVENTORY':
    case 'DELETE_INVENTORY':
    case 'ADJUST_STOCK':
    case 'CREATE_MAINTENANCE':
    case 'SEND_MESSAGE':
    case 'REPLY_MESSAGE':
      return 'تم التنفيذ';
    default:
      return 'تم التنفيذ';
  }
}

function parseDetails(details?: string | null) {
  if (!details) return null;
  try {
    return JSON.parse(details);
  } catch {
    return null;
  }
}

function buildServerDescription(row: ServerAuditRow) {
  const details = parseDetails(row.details);

  switch (row.action) {
    case 'CREATE_REQUEST':
      return `تم إنشاء طلب مواد${details?.code ? ` برقم ${details.code}` : ''}${details?.items ? ` بعدد ${details.items} أصناف` : ''}.`;
    case 'APPROVE_REQUEST':
      return 'تم اعتماد طلب مواد وتحويله إلى مرحلة الصرف.';
    case 'ISSUE_REQUEST':
      return 'تم صرف الطلب وإنشاء العهد المرتبطة به عند الحاجة.';
    case 'CREATE_RETURN_REQUEST':
      return `تم إنشاء طلب إرجاع${details?.code ? ` برقم ${details.code}` : ''}${details?.itemName ? ` للمادة ${details.itemName}` : ''}.`;
    case 'APPROVE_RETURN_REQUEST':
      return `تم استلام المادة وتوثيق حالتها${details?.receivedType ? ` (${details.receivedType})` : ''}.`;
    case 'REJECT_RETURN_REQUEST':
      return `تم رفض طلب الإرجاع${details?.reason ? ` بسبب: ${details.reason}` : ''}.`;
    case 'CREATE_INVENTORY':
      return `تمت إضافة مادة جديدة للمخزون${details?.code ? ` (${details.code})` : ''}${details?.name ? ` - ${details.name}` : ''}.`;
    case 'UPDATE_INVENTORY':
      return 'تم تحديث بيانات مادة مخزنية قائمة.';
    case 'DELETE_INVENTORY':
      return 'تم حذف مادة من المخزون.';
    case 'ADJUST_STOCK':
      return `تم تعديل كمية المخزون${details?.quantityChange !== undefined ? ` بمقدار ${details.quantityChange}` : ''}${details?.reason ? ` بسبب: ${details.reason}` : ''}.`;
    case 'CREATE_MAINTENANCE':
      return `تم إنشاء طلب صيانة${details?.code ? ` برقم ${details.code}` : ''}.`;
    default:
      return 'تم تنفيذ إجراء مسجل في النظام.';
  }
}

export default function AuditLogsPage() {
  const { user, allUsers } = useAuth();
  const [serverLogs, setServerLogs] = useState<ServerAuditRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchServerLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs?limit=300', { cache: 'no-store' });
      const data = await res.json();
      setServerLogs(Array.isArray(data?.data) ? data.data : []);
    } catch {
      setServerLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchServerLogs();
  }, []);

  const localRows = useMemo<UnifiedAuditRow[]>(() => {
    const usersMap = new Map(allUsers.map((item) => [item.id, item]));
    const messageRows = loadLocal<StoredMessage>(MESSAGES_STORAGE_KEY).map((msg) => {
      const sender = usersMap.get(msg.senderId);
      const receiver = usersMap.get(msg.receiverId);
      const isReply = Boolean(msg.parentMessageId);

      return {
        id: `local-msg-${msg.id}`,
        source: 'LOCAL',
        createdAt: msg.createdAt,
        actorName: sender?.fullName || 'غير معروف',
        actorRole: roleLabel(sender?.role),
        action: isReply ? 'REPLY_MESSAGE' : 'SEND_MESSAGE',
        entity: 'Message',
        entityId: msg.threadId,
        result: 'تم التنفيذ',
        description: isReply
          ? `تم إرسال رد داخلي${msg.subject ? ` بعنوان: ${msg.subject}` : ''}${receiver?.fullName ? ` إلى ${receiver.fullName}` : ''}.`
          : `تم إرسال رسالة داخلية${msg.subject ? ` بعنوان: ${msg.subject}` : ''}${receiver?.fullName ? ` إلى ${receiver.fullName}` : ''}.`,
        ipAddress: null,
      };
    });

    const returnRows = loadLocal<StoredReturn>(RETURNS_STORAGE_KEY).map((ret) => {
      const requester = usersMap.get(ret.userId);

      return {
        id: `local-return-${ret.id}`,
        source: 'LOCAL',
        createdAt: ret.createdAt,
        actorName: requester?.fullName || 'غير معروف',
        actorRole: roleLabel(requester?.role),
        action: 'LOCAL_CREATE_RETURN_REQUEST',
        entity: 'ReturnRequest',
        entityId: ret.id,
        result:
          ret.status === 'APPROVED'
            ? 'تم الاستلام'
            : ret.status === 'REJECTED'
            ? 'تم الرفض'
            : 'قيد المعالجة',
        description: `تم إنشاء طلب إرجاع${ret.custodyId ? ` مرتبط بالعهدة ${ret.custodyId}` : ''}${ret.returnType ? ` والحالة المبلّغ عنها ${ret.returnType}` : ''}.`,
        ipAddress: null,
      };
    });

    return [...messageRows, ...returnRows];
  }, [allUsers]);

  const mergedRows = useMemo<UnifiedAuditRow[]>(() => {
    const serverRows: UnifiedAuditRow[] = serverLogs.map((row) => ({
      id: row.id,
      source: 'SERVER',
      createdAt: row.createdAt,
      actorName: row.user?.fullName || 'غير معروف',
      actorRole: roleLabel(row.user?.role),
      action: row.action,
      entity: row.entity,
      entityId: row.entityId,
      result: resultLabel(row.action),
      description: buildServerDescription(row),
      ipAddress: row.ipAddress,
    }));

    const rows = [...localRows, ...serverRows];

    return rows.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }, [localRows, serverLogs]);

  const stats = useMemo(() => {
    return {
      total: mergedRows.length,
      server: mergedRows.filter((row) => row.source === 'SERVER').length,
      local: mergedRows.filter((row) => row.source === 'LOCAL').length,
      requests: mergedRows.filter((row) => row.entity === 'Request').length,
      returns: mergedRows.filter((row) => row.entity === 'ReturnRequest').length,
      inventory: mergedRows.filter((row) => row.entity === 'InventoryItem').length,
      messages: mergedRows.filter((row) => row.entity === 'Message').length,
    };
  }, [mergedRows]);

  if (user?.role !== 'manager') {
    return (
      <Card className="rounded-[28px] border border-surface-border p-8 text-center text-surface-subtle">
        هذه الصفحة مخصصة للمدير فقط.
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div>
          <h1 className="text-[30px] leading-[1.25] text-primary">سجلات التدقيق</h1>
          <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
            ذاكرة رقابية موحدة ترصد الإجراءات ذات الأثر داخل المنصة: من نفّذ، ماذا نفّذ، ومتى تم ذلك.
          </p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-none">
            <div className="text-[13px] text-slate-600">إجمالي السجلات</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.total}</div>
          </Card>

          <Card className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 shadow-none">
            <div className="text-[13px] text-emerald-700">سجلات الخادم</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.server}</div>
          </Card>

          <Card className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 shadow-none">
            <div className="text-[13px] text-amber-700">سجلات محلية</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.local}</div>
          </Card>

          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-none">
            <div className="text-[13px] text-slate-600">الطلبات</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.requests}</div>
          </Card>

          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-none">
            <div className="text-[13px] text-slate-600">الإرجاعات</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.returns}</div>
          </Card>

          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-none">
            <div className="text-[13px] text-slate-600">المراسلات</div>
            <div className="mt-2 text-[30px] leading-none text-slate-900">{stats.messages}</div>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden rounded-[28px] border border-surface-border shadow-soft">
        {loading ? (
          <div className="p-10 text-center text-surface-subtle">جارٍ تحميل سجلات التدقيق...</div>
        ) : mergedRows.length === 0 ? (
          <div className="p-10 text-center text-surface-subtle">لا توجد سجلات تدقيق حالية</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] text-right">
              <thead className="border-b bg-surface">
                <tr>
                  <th className="p-4 font-semibold text-primary">التاريخ والوقت</th>
                  <th className="p-4 font-semibold text-primary">المستخدم</th>
                  <th className="p-4 font-semibold text-primary">الدور</th>
                  <th className="p-4 font-semibold text-primary">الإجراء</th>
                  <th className="p-4 font-semibold text-primary">العنصر</th>
                  <th className="p-4 font-semibold text-primary">النتيجة</th>
                  <th className="p-4 font-semibold text-primary">الوصف</th>
                  <th className="p-4 font-semibold text-primary">المصدر</th>
                  <th className="p-4 font-semibold text-primary">IP</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-100">
                {mergedRows.map((row) => (
                  <tr key={row.id} className="hover:bg-surface/50">
                    <td className="p-4 text-sm">{formatDate(row.createdAt)}</td>
                    <td className="p-4 font-medium">{row.actorName}</td>
                    <td className="p-4 text-sm text-slate-600">{row.actorRole}</td>
                    <td className="p-4 text-sm">
                      <Badge variant="info">{actionLabel(row.action)}</Badge>
                    </td>
                    <td className="p-4 text-sm">
                      <div className="font-medium text-slate-900">{entityLabel(row.entity)}</div>
                      <div className="mt-1 text-xs text-slate-500">{row.entityId || '-'}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-700">{row.result}</td>
                    <td className="p-4 text-sm leading-7 text-slate-700">{row.description}</td>
                    <td className="p-4 text-sm">
                      <Badge variant={row.source === 'SERVER' ? 'success' : 'warning'}>
                        {row.source === 'SERVER' ? 'الخادم' : 'محلي'}
                      </Badge>
                    </td>
                    <td className="p-4 font-mono text-xs text-surface-subtle">
                      {row.ipAddress || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}