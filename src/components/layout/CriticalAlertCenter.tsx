'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AlertItem = {
  id: string;
  title: string;
  message: string;
  createdAt?: string;
};

type ApiResponse = {
  alerts?: AlertItem[];
};

type CriticalAlertCenterProps = {
  userId: string;
};

const AUTO_HIDE_MS = 5000;

export function CriticalAlertCenter({ userId }: CriticalAlertCenterProps) {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const dismissedIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;

    let isMounted = true;

    const loadAlerts = async () => {
      try {
        const response = await fetch(`/api/notifications?critical=1&userId=${encodeURIComponent(userId)}`, {
          cache: 'no-store',
          credentials: 'include',
        });

        if (!response.ok) return;

        const json: ApiResponse = await response.json().catch(() => ({ alerts: [] }));
        const incoming = Array.isArray(json?.alerts) ? json.alerts : [];

        const filtered = incoming.filter((item) => !dismissedIdsRef.current.has(item.id));

        if (isMounted) {
          setAlerts(filtered.slice(0, 4));
        }
      } catch {
        if (isMounted) {
          setAlerts([]);
        }
      }
    };

    loadAlerts();
    const interval = window.setInterval(loadAlerts, 15000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [userId]);

  useEffect(() => {
    if (alerts.length === 0) return;

    const timers = alerts.map((alert) =>
      window.setTimeout(() => {
        dismissedIdsRef.current.add(alert.id);
        setAlerts((current) => current.filter((item) => item.id !== alert.id));
      }, AUTO_HIDE_MS)
    );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [alerts]);

  const visibleAlerts = useMemo(() => alerts.slice(0, 4), [alerts]);

  const dismissAlert = (id: string) => {
    dismissedIdsRef.current.add(id);
    setAlerts((current) => current.filter((item) => item.id !== id));
  };

  if (visibleAlerts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed left-4 top-4 z-[120] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-3">
      {visibleAlerts.map((alert) => (
        <div
          key={alert.id}
          className="pointer-events-auto rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-20px_rgba(15,23,42,0.35)]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 text-right">
              <p className="text-[18px] font-bold text-[#016564]">{alert.title}</p>
              <p className="mt-1 text-[13px] leading-6 text-slate-600">{alert.message}</p>
            </div>

            <button
              type="button"
              onClick={() => dismissAlert(alert.id)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
              aria-label="إغلاق التنبيه"
              title="إغلاق"
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
