'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useAuth } from '@/context/AuthContext';
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';

type FilterKey = 'ALL' | 'UNREAD' | 'ALERT' | 'NOTIFICATION' | 'CRITICAL' | 'ACTION';

type NotificationMeta = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
  kind?: 'alert' | 'notification';
  severity?: 'info' | 'action' | 'critical';
};

function formatDate(date?: string) {
  if (!date) return '—';
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

function normalizeNotification(item: NotificationMeta): NotificationMeta {
  const type = String(item.type || '').toUpperCase();
  const entityType = String(item.entityType || '').toLowerCase();

  const severity =
    type.includes('CRITICAL') || type.includes('OUT_OF_STOCK')
      ? 'critical'
      : type.includes('LOW_STOCK') || type.includes('NEW_') || type.includes('PENDING')
      ? 'action'
      : 'info';

  const kind =
    severity === 'critical' || severity === 'action' || entityType === 'message' ? 'alert' : 'notification';

  return { ...item, severity, kind };
}

function typeLabel(item: NotificationMeta) {
  return item.kind === 'alert' ? 'تنبيه' : 'إشعار';
}

function severityLabel(item: NotificationMeta) {
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

function badgeClasses(item: InventoryNotification) {
  if (item.severity === 'critical') return 'bg-[#7c1e3e]/10 text-[#7c1e3e]';
  if (item.kind === 'alert' || item.severity === 'action') return 'bg-[#d0b284]/15 text-[#8a6a28]';
  return 'bg-[#016564]/10 text-[#016564]';
}

function resolveItemLink(item: InventoryNotification): string | null {
  const meta = item as NotificationMeta;

  if (item.link && item.link !== '/notifications') {
    return item.link;
  }

  const entityType = String(meta.entityType || '').toLowerCase();

  if (entityType === 'message' && meta.entityId) return `/messages?open=${meta.entityId}`;
  if (entityType === 'request' && meta.entityId) return `/requests?open=${meta.entityId}`;
  if (entityType === 'return' && meta.entityId) return `/returns?open=${meta.entityId}`;
  if (entityType === 'custody' && meta.entityId) return `/custody?open=${meta.entityId}`;
  if (entityType === 'inventory' && meta.entityId) return `/inventory?open=${meta.entityId}`;
  if (entityType === 'suggestion' && meta.entityId) return '/dashboard';

  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [filter, setFilter] = useState<FilterKey>('ALL');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<NotificationMeta[]>([]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    const refresh = async () => {
      const response = await fetch('/api/notifications', {
        cache: 'no-store',
        credentials: 'include',
      }).catch(() => null);

      const json = response ? await response.json().catch(() => null) : null;
      if (!mounted) return;
      const rows = Array.isArray(json?.data) ? json.data.map(normalizeNotification) : [];
      setItems(rows);
    };

    refresh();

    window.addEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);
    window.addEventListener('focus', refresh);

    return () => {
      mounted = false;
      window.removeEventListener(NOTIFICATIONS_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [user?.id]);

  const stats = useMemo(() => {
    return {
      total: items.length,
      unread: items.filter((item) => !item.isRead).length,
      alerts: items.filter((item) => item.kind === 'alert').length,
      critical: items.filter((item) => item.severity === 'critical').length,
      actions: items.filter((item) => item.severity === 'action').length,
    };
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeArabic(search);

    return items.filter((item) => {
      const matchesFilter =
        filter === 'ALL'
          ? true
          : filter === 'UNREAD'
          ? !item.isRead
          : filter === 'ALERT'
          ? item.kind === 'alert'
          : filter === 'NOTIFICATION'
          ? item.kind === 'notification'
          : filter === 'CRITICAL'
          ? item.severity === 'critical'
          : item.severity === 'action';

      const haystack = normalizeArabic(
        [item.title, item.message, item.entityType, item.entityId].filter(Boolean).join(' ')
      );

      const matchesSearch = q ? haystack.includes(q) : true;
      return matchesFilter && matchesSearch;
    });
  }, [filter, items, search]);

  const handleMarkAllRead = async () => {
    const unread = items.filter((item) => !item.isRead);
    await Promise.all(
      unread.map((item) =>
        fetch('/api/notifications', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ id: item.id }),
        }).catch(() => null)
      )
    );

    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
  };

  const handleMarkRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    }).catch(() => null);

    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  const handleOpenItem = async (item: NotificationMeta) => {
    const target = resolveItemLink(item);

    if (!item.isRead) {
      await handleMarkRead(item.id);
    }

    if (target) {
      router.push(target);
    }
  };

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className="rounded-[24px] border border-[#d6d7d4] bg-white px-4 py-4 shadow-sm sm:rounded-[28px] sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="text-[24px] font-extrabold leading-[1.25] text-[#016564] sm:text-[30px]">
              الإشعارات والتنبيهات
            </h1>
            <p className="mt-2 text-[13px] leading-7 text-[#61706f] sm:text-sm">
              سجل موحد يوضح ما يخصك من مستجدات تشغيلية واعتمادات ورسائل وتنبيهات مرتبطة بالمخزون أو العهد أو المسارات الخدمية.
            </p>
          </div>

          <Button variant="secondary" onClick={handleMarkAllRead} className="w-full sm:w-auto">
            تعليم الكل كمقروء
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 xl:grid-cols-5">
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">إجمالي الإشعارات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.total}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">غير المقروءة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#d0b284]">{stats.unread}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">التنبيهات</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#8a6a28]">{stats.alerts}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">الحرجة</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#7c1e3e]">{stats.critical}</div>
          </Card>
          <Card className="rounded-[20px] border border-[#d6d7d4] p-3 shadow-none sm:rounded-2xl">
            <div className="text-[12px] text-[#6f7b7a]">تحتاج إجراء</div>
            <div className="mt-1 text-[22px] font-extrabold leading-none text-[#016564]">{stats.actions}</div>
          </Card>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:rounded-[28px] sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <Input
            label="بحث"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="العنوان، المحتوى، أو نوع الإشعار"
          />

          <div className="flex flex-wrap gap-2 self-end">
            {[
              ['ALL', 'الكل'],
              ['UNREAD', 'غير المقروءة'],
              ['ALERT', 'التنبيهات'],
              ['NOTIFICATION', 'الإشعارات'],
              ['CRITICAL', 'الحرجة'],
              ['ACTION', 'تحتاج إجراء'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key as FilterKey)}
                className={`rounded-full px-4 py-2 text-xs transition ${
                  filter === key
                    ? 'bg-[#016564] text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-3">
        {filteredItems.length === 0 ? (
          <Card className="rounded-[24px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm sm:rounded-[28px]">
            لا توجد إشعارات مطابقة
          </Card>
        ) : (
          filteredItems.map((item) => (
            <Card
              key={item.id}
              className={`rounded-[24px] border p-4 shadow-sm transition sm:rounded-[28px] sm:p-5 ${itemClasses(item)}`}
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-[11px] ${badgeClasses(item)}`}>{typeLabel(item)}</span>
                    <span className={`rounded-full px-3 py-1 text-[11px] ${badgeClasses(item)}`}>{severityLabel(item)}</span>
                    {!item.isRead ? (
                      <span className="rounded-full bg-[#d0b284]/15 px-3 py-1 text-[11px] text-[#8a6a28]">
                        جديد
                      </span>
                    ) : null}
                  </div>

                  <div className="break-words text-[15px] font-bold leading-7 text-[#152625] sm:text-base">
                    {item.title}
                  </div>

                  <div className="break-words text-sm leading-7 text-[#304342]">{item.message}</div>

                  <div className="text-[12px] text-[#61706f]">
                    {formatDate(item.createdAt)}
                  </div>
                </div>

                <div className="flex w-full flex-col gap-2 sm:w-auto">
                  {!item.isRead ? (
                    <Button variant="ghost" onClick={() => handleMarkRead(item.id)} className="w-full sm:w-auto">
                      تعليم كمقروء
                    </Button>
                  ) : null}

                  {resolveItemLink(item) ? (
                    <Button onClick={() => handleOpenItem(item)} className="w-full sm:w-auto">
                      فتح العنصر
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))
        )}
      </section>
    </div>
  );
}
