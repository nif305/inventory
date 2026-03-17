'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import {
  InventoryNotification,
  NOTIFICATIONS_UPDATED_EVENT,
  loadNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/notifications';

type FilterKey = 'ALL' | 'UNREAD' | 'ALERT' | 'NOTIFICATION' | 'CRITICAL';

type NotificationMeta = InventoryNotification & {
  entityType?: string;
  entityId?: string;
};

function formatDate(date?: string) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return date;
  }
}

function typeLabel(item: InventoryNotification) {
  return item.kind === 'alert' ? 'تنبيه' : 'إشعار';
}

function severityLabel(item: InventoryNotification) {
  if (item.severity === 'critical') return 'حرج';
  if (item.severity === 'action') return 'إجراء';
  return 'معلوماتي';
}

function itemClasses(item: InventoryNotification) {
  if (item.severity === 'critical') {
    return 'border-[#7c1e3e]/15 bg-[#7c1e3e]/[0.04]';
  }

  if (item.kind === 'alert' || item.severity === 'action') {
    return 'border-[#d0b284]/25 bg-[#d0b284]/[0.10]';
  }

  return 'border-slate-200 bg-white';
}

function resolveItemLink(item: InventoryNotification): string | null {
  const meta = item as NotificationMeta;

  if (item.link && item.link !== '/notifications') {
    return item.link;
  }

  const entityType = (meta.entityType || '').toLowerCase();

  if (entityType === 'message' && meta.entityId) {
    return `/messages?open=${meta.entityId}`;
  }

  if (entityType === 'request' && meta.entityId) {
    return `/requests?open=${meta.entityId}`;
  }

  if (entityType === 'return' && meta.entityId) {
    return `/returns?open=${meta.entityId}`;
  }

  if (entityType === 'custody' && meta.entityId) {
    return `/custody?open=${meta.entityId}`;
  }

  if (entityType === 'inventory' && meta.entityId) {
    return `/inventory?open=${meta.entityId}`;
  }

  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [items, setItems] = useState<InventoryNotification[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    const refresh = () => setItems(loadNotifications(user.id));
    refresh();

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.isRead).length,
      alerts: items.filter((item) => item.kind === 'alert').length,
      critical: items.filter((item) => item.severity === 'critical').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    if (filter === 'UNREAD') return items.filter((item) => !item.isRead);
    if (filter === 'ALERT') return items.filter((item) => item.kind === 'alert');
    if (filter === 'NOTIFICATION') return items.filter((item) => item.kind === 'notification');
    if (filter === 'CRITICAL') return items.filter((item) => item.severity === 'critical');
    return items;
  }, [filter, items]);

  const handleMarkAllRead = () => {
    if (!user?.id) return;
    markAllNotificationsRead(user.id);
    setItems(loadNotifications(user.id));
  };

  const handleMarkRead = (id: string) => {
    markNotificationRead(id);
    if (user?.id) setItems(loadNotifications(user.id));
  };

  const handleOpenItem = (item: InventoryNotification) => {
    const target = resolveItemLink(item);

    if (!target) {
      return;
    }

    if (!item.isRead) {
      markNotificationRead(item.id);
      if (user?.id) {
        setItems(loadNotifications(user.id));
      }
    }

    router.push(target);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-[1.25] text-primary">الإشعارات والتنبيهات</h1>
            <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
              سجل موحد يوضح ما يخصك من مستجدات تشغيلية، واعتمادات، وإرجاعات، وتنبيهات مرتبطة بالمخزون أو العهد.
            </p>
          </div>

          <Button variant="secondary" onClick={handleMarkAllRead}>
            تعليم الكل كمقروء
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <Card className="rounded-[22px] border border-slate-200 bg-slate-50 p-4 shadow-none">
            <div className="text-[13px] text-slate-600">إجمالي العناصر</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.total}</div>
          </Card>

          <Card className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4 shadow-none">
            <div className="text-[13px] text-emerald-700">غير المقروء</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.unread}</div>
          </Card>

          <Card className="rounded-[22px] border border-amber-200 bg-amber-50 p-4 shadow-none">
            <div className="text-[13px] text-amber-700">التنبيهات</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.alerts}</div>
          </Card>

          <Card className="rounded-[22px] border border-rose-200 bg-rose-50 p-4 shadow-none">
            <div className="text-[13px] text-rose-700">العناصر الحرجة</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{stats.critical}</div>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {[
            { key: 'ALL', label: 'الكل' },
            { key: 'UNREAD', label: 'غير المقروء' },
            { key: 'ALERT', label: 'التنبيهات' },
            { key: 'NOTIFICATION', label: 'الإشعارات' },
            { key: 'CRITICAL', label: 'الحرجة' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key as FilterKey)}
              className={`rounded-full px-4 py-2 text-sm transition ${
                filter === tab.key ? 'bg-[#016564] text-white' : 'border border-slate-200 bg-white text-slate-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {filteredItems.length === 0 ? (
          <Card className="rounded-[28px] border border-dashed border-slate-200 p-10 text-center text-slate-500">
            لا توجد عناصر مطابقة لهذا التصنيف
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`rounded-[28px] border p-5 shadow-soft ${itemClasses(item)}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] leading-none text-slate-700">
                      {typeLabel(item)}
                    </span>
                    <span className="rounded-full bg-white/90 px-3 py-1 text-[11px] leading-none text-slate-700">
                      {severityLabel(item)}
                    </span>
                    {!item.isRead ? (
                      <span className="rounded-full bg-[#016564]/10 px-3 py-1 text-[11px] leading-none text-[#016564]">
                        جديد
                      </span>
                    ) : null}
                  </div>

                  <h2 className="mt-3 text-[20px] leading-8 text-slate-900">{item.title}</h2>
                  <p className="mt-2 text-[14px] leading-8 text-slate-600">{item.message}</p>
                  <div className="mt-3 text-[12px] text-slate-500">{formatDate(item.createdAt)}</div>
                </div>

                <div className="flex shrink-0 flex-wrap gap-2">
                  {!item.isRead ? (
                    <Button variant="secondary" onClick={() => handleMarkRead(item.id)}>
                      تعليم كمقروء
                    </Button>
                  ) : null}

                  {resolveItemLink(item) ? (
                    <Button onClick={() => handleOpenItem(item)}>فتح</Button>
                  ) : (
                    <Button disabled>لا يوجد مسار</Button>
                  )}
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
} 