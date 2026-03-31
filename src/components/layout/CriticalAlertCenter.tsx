'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { NOTIFICATIONS_UPDATED_EVENT } from '@/lib/notifications';

type ServerNotification = {
  id: string;
  title: string;
  message: string;
  link?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  isRead: boolean;
  createdAt: string;
  type?: string | null;
};

function normalizeNotification(item: ServerNotification) {
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

function isUrgentCenterItem(item: ReturnType<typeof normalizeNotification>) {
  const entityType = String(item.entityType || '').toLowerCase();
  return item.severity === 'critical' || item.kind === 'alert' || entityType === 'message';
}

function resolveItemLink(item: ReturnType<typeof normalizeNotification>): string | null {
  const entityType = (item.entityType || '').toLowerCase();

  if (item.link && item.link !== '/notifications') return item.link;
  if (entityType === 'message' && item.entityId) return `/messages?open=${item.entityId}`;
  if (entityType === 'request' && item.entityId) return `/requests?open=${item.entityId}`;
  if (entityType === 'return' && item.entityId) return `/returns?open=${item.entityId}`;
  if (entityType === 'custody' && item.entityId) return `/custody?open=${item.entityId}`;
  if (entityType === 'inventory' && item.entityId) return `/inventory?open=${item.entityId}`;
  if (entityType === 'suggestion' && item.entityId) return '/dashboard';
  return '/notifications';
}

function getUrgentLabel(item: ReturnType<typeof normalizeNotification>) {
  const entityType = String(item.entityType || '').toLowerCase();
  if (entityType === 'message') return 'رسالة داخلية مهمة';
  if (item.severity === 'critical') return 'تنبيه مهم وعاجل';
  return 'تنبيه يحتاج انتباهًا مباشرًا';
}

function getUrgentNote(item: ReturnType<typeof normalizeNotification>) {
  const entityType = String(item.entityType || '').toLowerCase();
  if (entityType === 'message') {
    return 'هذه الرسالة الداخلية عُدّت ذات أولوية عالية، لذلك تظهر مباشرة عند فتح النظام حتى لا تفوتك.';
  }
  return 'سيبقى هذا التنبيه ظاهرًا حتى تطّلع عليه أو تفتح العنصر المرتبط به.';
}

export function CriticalAlertCenter({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<ReturnType<typeof normalizeNotification>[]>([]);
  const active = useMemo(() => items.find((item) => !item.isRead && isUrgentCenterItem(item)) || null, [items]);

  useEffect(() => {
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
  }, [userId]);

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ id }),
    }).catch(() => null);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, isRead: true } : item)));
  };

  if (!active) return null;

  return (
    <div className="fixed inset-x-3 top-4 z-[95] mx-auto w-full max-w-4xl sm:inset-x-6">
      <div className="rounded-[26px] border border-[#7c1e3e]/15 bg-white/95 p-4 shadow-[0_24px_80px_rgba(124,30,62,0.22)] backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 rounded-full bg-[#7c1e3e]/10 px-3 py-1 text-[11px] font-semibold text-[#7c1e3e]">
              <span className="h-2 w-2 rounded-full bg-[#7c1e3e]" />
              {getUrgentLabel(active)}
            </div>
            <div className="mt-3 text-[18px] font-extrabold text-slate-900 sm:text-[20px]">{active.title}</div>
            <div className="mt-2 text-[13px] leading-7 text-slate-600 sm:text-[14px]">{active.message}</div>
            <div className="mt-3 text-[12px] leading-6 text-slate-500">{getUrgentNote(active)}</div>
          </div>

          <div className="flex flex-col gap-2 sm:w-auto sm:min-w-[190px]">
            <button
              type="button"
              onClick={async () => {
                await markRead(active.id);
                router.push(resolveItemLink(active) || '/notifications');
              }}
              className="rounded-2xl bg-[#016564] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#015150]"
            >
              فتح الآن
            </button>
            <button
              type="button"
              onClick={() => markRead(active.id)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
            >
              تعليم كمقروء
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
