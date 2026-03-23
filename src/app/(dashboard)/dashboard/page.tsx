'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';

type GenericRecord = Record<string, any>;
type Level = 'primary' | 'secondary' | 'critical' | 'warning' | 'normal';

type Metric = {
  title: string;
  value: number;
  note: string;
  href: string;
  icon: string;
  level: Level;
};

type Shortcut = {
  title: string;
  href: string;
  icon: string;
  note?: string;
};

type FeedItem = {
  id: string;
  title: string;
  note: string;
  href: string;
  level: Level;
};

const RETURNS_STORAGE_KEY = 'inventory_returns';
const CUSTODY_STORAGE_KEY = 'inventory_custody_items';
const NOTIFICATIONS_STORAGE_KEY = 'inventory_notifications';

function readStorageArray(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getDaysLate(value?: string | null) {
  if (!value) return 0;
  const now = new Date();
  const target = new Date(value);
  const diff = now.getTime() - target.getTime();
  return diff > 0 ? Math.ceil(diff / 86400000) : 0;
}

function getRelativeTime(value?: string | null) {
  if (!value) return '—';
  try {
    const diff = Math.max(0, Date.now() - new Date(value).getTime());
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (minutes < 60) return `منذ ${minutes || 1} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    return `منذ ${days} يوم`;
  } catch {
    return '—';
  }
}

function getTone(level: Level) {
  if (level === 'primary') {
    return {
      dot: 'bg-[#016564]',
      surface: 'bg-[#016564]/[0.05]',
      border: 'border-[#016564]/30',
      badge: 'bg-[#016564] text-white shadow-sm',
      arrow: 'text-[#016564]',
    };
  }

  if (level === 'secondary') {
    return {
      dot: 'bg-[#d0b284]',
      surface: 'bg-[#d0b284]/[0.10]',
      border: 'border-[#d0b284]/35',
      badge: 'bg-[#d0b284] text-white shadow-sm',
      arrow: 'text-[#b59667]',
    };
  }

  if (level === 'critical') {
    return {
      dot: 'bg-[#7c1e3e]',
      surface: 'bg-[#7c1e3e]/[0.04]',
      border: 'border-[#7c1e3e]/15',
      badge: 'bg-[#7c1e3e]/10 text-[#7c1e3e]',
      arrow: 'text-[#7c1e3e]',
    };
  }

  if (level === 'warning') {
    return {
      dot: 'bg-[#d0b284]',
      surface: 'bg-[#d0b284]/[0.10]',
      border: 'border-[#d0b284]/30',
      badge: 'bg-[#d0b284]/15 text-[#7a6129]',
      arrow: 'text-[#b59667]',
    };
  }

  return {
    dot: 'bg-[#016564]',
    surface: 'bg-[#016564]/[0.04]',
    border: 'border-[#016564]/15',
    badge: 'bg-[#016564]/10 text-[#016564]',
    arrow: 'text-[#016564]',
  };
}

function Icon({ name, className = 'h-5 w-5' }: { name: string; className?: string }) {
  const props = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <rect {...props} x="4" y="4" width="6" height="6" />
          <rect {...props} x="14" y="4" width="6" height="6" />
          <rect {...props} x="4" y="14" width="6" height="6" />
          <rect {...props} x="14" y="14" width="6" height="6" />
        </svg>
      );
    case 'requests':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M9 4h6l1 2h3v14H5V6h3l1-2Z" />
          <path {...props} d="M9 10h6M9 14h6" />
        </svg>
      );
    case 'returns':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M8 7H4v4" />
          <path {...props} d="M4 11a8 8 0 1 0 2-5.3L8 7" />
        </svg>
      );
    case 'custody':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M9 7V5h6v2" />
          <path {...props} d="M4 8h16v10H4z" />
          <path {...props} d="M4 12h16" />
        </svg>
      );
    case 'inventory':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="m12 3 8 4.5v9L12 21 4 16.5v-9L12 3Z" />
          <path {...props} d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
        </svg>
      );
    case 'audit':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M7 4h7l5 5v11H7z" />
          <path {...props} d="M14 4v5h5M10 13h4M10 17h6" />
        </svg>
      );
    case 'notifications':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path {...props} d="M10 19a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'users':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M16 19a4 4 0 0 0-8 0" />
          <circle {...props} cx="12" cy="11" r="3" />
          <path {...props} d="M19 19a3 3 0 0 0-3-3M18 10a2.5 2.5 0 1 0-2.5-2.5" />
        </svg>
      );
    case 'trend':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M4 16 10 10l4 4 6-7" />
          <path {...props} d="M17 7h3v3" />
        </svg>
      );
    case 'warning':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M12 4 3.5 19h17L12 4Z" />
          <path {...props} d="M12 9v4M12 17h.01" />
        </svg>
      );
    case 'maintenance':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="m14.7 6.3 3 3-8.4 8.4H6.3v-3L14.7 6.3Z" />
          <path {...props} d="m13.3 7.7 3 3" />
        </svg>
      );
    case 'cleaning':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M7 21h10" />
          <path {...props} d="M12 3v12" />
          <path {...props} d="m8 7 4-4 4 4" />
          <path {...props} d="M8 15h8" />
        </svg>
      );
    case 'purchase':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle {...props} cx="9" cy="20" r="1.5" />
          <circle {...props} cx="17" cy="20" r="1.5" />
          <path {...props} d="M3 4h2l2.4 10.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 7H7" />
        </svg>
      );
    case 'other':
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <circle {...props} cx="12" cy="12" r="8" />
          <path {...props} d="M9.5 9a2.5 2.5 0 1 1 4 2c-.8.6-1.5 1.1-1.5 2" />
          <path {...props} d="M12 17h.01" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" className={className}>
          <path {...props} d="M5 12h14" />
          <path {...props} d="m13 6 6 6-6 6" />
        </svg>
      );
  }
}

function ShellCard({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`rounded-[28px] border border-[#dde8e6] bg-white p-5 shadow-sm ${className}`}>{children}</div>;
}

function SectionHeader({ title, note, href, action }: { title: string; note: string; href?: string; action?: string }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div>
        <h2 className="text-[20px] leading-[1.2] text-slate-900">{title}</h2>
        <p className="mt-1 text-[13px] leading-6 text-slate-500">{note}</p>
      </div>
      {href && action ? (
        <Link
          href={href}
          className="inline-flex items-center gap-2 rounded-full border border-[#d7e5e2] bg-white px-4 py-2 text-[13px] text-[#016564] transition hover:border-[#016564]"
        >
          <Icon name="arrow" className="h-4 w-4" />
          {action}
        </Link>
      ) : null}
    </div>
  );
}

function MetricGrid({ items }: { items: Metric[] }) {
  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => {
        const tone = getTone(item.level);
        return (
          <Link href={item.href} key={item.title}>
            <div className={`h-full rounded-[28px] border p-5 transition hover:-translate-y-[2px] hover:shadow-lg ${tone.border} ${tone.surface}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[13px] leading-6 text-slate-600">{item.title}</div>
                  <div className="mt-3 text-[34px] leading-none text-slate-900">{item.value}</div>
                  <div className="mt-3 text-[13px] leading-7 text-slate-600">{item.note}</div>
                </div>
                <div className={`rounded-[20px] p-3 ${tone.badge}`}>
                  <Icon name={item.icon} className="h-6 w-6" />
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </section>
  );
}

function FeedList({ items, emptyText }: { items: FeedItem[]; emptyText: string }) {
  if (!items.length) {
    return <div className="rounded-[22px] border border-dashed border-[#d8e4e2] p-10 text-center text-slate-500">{emptyText}</div>;
  }

  return (
    <div className="space-y-3">
      {items.map((item) => {
        const tone = getTone(item.level);
        return (
          <Link href={item.href} key={item.id} className={`block rounded-[22px] border p-4 ${tone.border} ${tone.surface}`}>
            <div className="flex items-start gap-3">
              <span className={`mt-2 h-2.5 w-2.5 rounded-full ${tone.dot}`} />
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-slate-900">{item.title}</div>
                <div className="mt-1 text-[12px] leading-6 text-slate-600">{item.note}</div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

function ShortcutGrid({ items, title = 'اختصارات', note = 'المسارات الأكثر استخدامًا' }: { items: Shortcut[]; title?: string; note?: string }) {
  return (
    <ShellCard>
      <SectionHeader title={title} note={note} />
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link
            href={item.href}
            key={item.title}
            className="group rounded-[22px] border border-[#e0ebe9] bg-[#fbfdfd] p-4 transition hover:border-[#c6dad7] hover:bg-white hover:shadow-md"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="rounded-[18px] bg-[#016564]/8 p-3 text-[#016564]">
                <Icon name={item.icon} className="h-5 w-5" />
              </div>
              <Icon name="arrow" className="h-4 w-4 text-slate-400 transition group-hover:text-[#016564]" />
            </div>
            <div className="mt-4 text-[15px] text-slate-900">{item.title}</div>
            {item.note ? <div className="mt-1 text-[12px] text-slate-500">{item.note}</div> : null}
          </Link>
        ))}
      </div>
    </ShellCard>
  );
}

function Hero({ badge, title, subtitle, stats }: { badge: string; title: string; subtitle: string; stats: { label: string; value: number; icon: string }[] }) {
  return (
    <section className="relative overflow-hidden rounded-[32px] border border-[#d8e4e2] bg-[linear-gradient(135deg,#016564_0%,#0c706e_55%,#114f4f_100%)] p-6 text-white shadow-[0_18px_50px_rgba(1,101,100,0.18)]">
      <div className="absolute -left-10 top-0 h-36 w-36 rounded-full bg-[#d0b284]/10 blur-2xl" />
      <div className="absolute bottom-0 right-0 h-44 w-44 rounded-full bg-white/5 blur-2xl" />
      <div className="relative grid gap-5 xl:grid-cols-[1.25fr_0.95fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/10 px-3 py-2 text-[12px]">
            <Icon name="dashboard" className="h-4 w-4" />
            {badge}
          </div>
          <h1 className="mt-4 text-[32px] leading-[1.2] text-white">{title}</h1>
          <p className="mt-3 max-w-[760px] text-[14px] leading-8 text-white/85">{subtitle}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {stats.map((item) => (
            <div key={item.label} className="rounded-[24px] border border-white/10 bg-white/10 p-4 backdrop-blur-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] text-white/75">{item.label}</div>
                  <div className="mt-2 text-[30px] leading-none">{item.value}</div>
                </div>
                <div className="rounded-2xl bg-white/10 p-3">
                  <Icon name={item.icon} className="h-6 w-6" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function normalizeSuggestionType(item: GenericRecord) {
  return String(item.requestType || item.category || item.type || '').toUpperCase();
}

function isOpenSuggestion(item: GenericRecord) {
  const status = String(item.status || '').toUpperCase();
  return status === 'PENDING' || status === 'UNDER_REVIEW' || status === 'APPROVED';
}

function ManagerDashboard({ fullName }: { fullName?: string }) {
  const [requests, setRequests] = useState<GenericRecord[]>([]);
  const [inventory, setInventory] = useState<GenericRecord[]>([]);
  const [returns, setReturns] = useState<GenericRecord[]>([]);
  const [custody, setCustody] = useState<GenericRecord[]>([]);
  const [notifications, setNotifications] = useState<GenericRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<GenericRecord[]>([]);
  const [suggestions, setSuggestions] = useState<GenericRecord[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const [requestsRes, inventoryRes, auditRes, suggestionsRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/inventory?limit=200', { cache: 'no-store' }),
        fetch('/api/audit-logs?limit=20', { cache: 'no-store' }).catch(() => null),
        fetch('/api/suggestions', { cache: 'no-store' }).catch(() => null),
      ]);

      const requestsJson = await requestsRes.json().catch(() => null);
      const inventoryJson = await inventoryRes.json().catch(() => null);
      const auditJson = auditRes ? await auditRes.json().catch(() => null) : null;
      const suggestionsJson = suggestionsRes ? await suggestionsRes.json().catch(() => null) : null;

      if (!active) return;

      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setInventory(Array.isArray(inventoryJson?.data) ? inventoryJson.data : []);
      setReturns(readStorageArray(RETURNS_STORAGE_KEY));
      setCustody(readStorageArray(CUSTODY_STORAGE_KEY));
      setNotifications(readStorageArray(NOTIFICATIONS_STORAGE_KEY));
      setAuditLogs(Array.isArray(auditJson?.data) ? auditJson.data : []);
      setSuggestions(Array.isArray(suggestionsJson?.data) ? suggestionsJson.data : []);
    })();

    return () => {
      active = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const pendingRequests = requests.filter((item) => item.status === 'PENDING').length;
    const approvedNotIssued = requests.filter((item) => item.status === 'APPROVED').length;
    const pendingReturns = returns.filter((item) => item.status === 'PENDING').length;
    const overdueCustody = custody.filter((item) => item.status === 'OVERDUE' || getDaysLate(item.dueDate) > 0).length;
    const lowStock = inventory.filter((item) => item.status === 'LOW_STOCK').length;
    const criticalAlerts = notifications.filter((item) => item.severity === 'critical' || item.kind === 'alert').length;
    const todayOps = auditLogs.filter((item) => {
      const createdAt = new Date(item.createdAt);
      const today = new Date();
      return (
        createdAt.getFullYear() === today.getFullYear() &&
        createdAt.getMonth() === today.getMonth() &&
        createdAt.getDate() === today.getDate()
      );
    }).length;

    const maintenancePending = suggestions.filter((item) => normalizeSuggestionType(item) === 'MAINTENANCE' && isOpenSuggestion(item)).length;
    const cleaningPending = suggestions.filter((item) => normalizeSuggestionType(item) === 'CLEANING' && isOpenSuggestion(item)).length;
    const purchasePending = suggestions.filter((item) => normalizeSuggestionType(item) === 'PURCHASE' && isOpenSuggestion(item)).length;
    const otherPending = suggestions.filter((item) => normalizeSuggestionType(item) === 'OTHER' && isOpenSuggestion(item)).length;

    return {
      pendingRequests,
      approvedNotIssued,
      pendingReturns,
      overdueCustody,
      lowStock,
      criticalAlerts,
      todayOps,
      maintenancePending,
      cleaningPending,
      purchasePending,
      otherPending,
      operationalPending: maintenancePending + cleaningPending + purchasePending + otherPending,
    };
  }, [requests, returns, custody, inventory, notifications, auditLogs, suggestions]);

  const decisionFeed = useMemo<FeedItem[]>(() => {
    const items: FeedItem[] = [];

    if (metrics.maintenancePending > 0) {
      items.push({
        id: 'op-maintenance',
        title: 'طلبات صيانة بانتظار المدير',
        note: `${metrics.maintenancePending} طلبًا يحتاج اعتمادًا أو تحويلًا للخدمات المساندة`,
        href: '/maintenance',
        level: 'critical',
      });
    }

    if (metrics.cleaningPending > 0) {
      items.push({
        id: 'op-cleaning',
        title: 'طلبات نظافة بانتظار المراجعة',
        note: `${metrics.cleaningPending} طلبًا مرتبطًا ببيئة المبنى أو البرامج التدريبية`,
        href: '/suggestions?category=CLEANING',
        level: 'warning',
      });
    }

    if (metrics.purchasePending > 0) {
      items.push({
        id: 'op-purchase',
        title: 'طلبات شراء مباشر قيد الاعتماد',
        note: `${metrics.purchasePending} طلبًا يحتاج قرارًا قبل تجهيز مسودة المالية`,
        href: '/purchases',
        level: 'warning',
      });
    }

    if (metrics.otherPending > 0) {
      items.push({
        id: 'op-other',
        title: 'طلبات أخرى بانتظار التوجيه',
        note: `${metrics.otherPending} طلبًا يحتاج تحديد الجهة المستفيدة والمسار الإداري`,
        href: '/suggestions?category=OTHER',
        level: 'normal',
      });
    }

    if (metrics.pendingRequests > 0) {
      items.push({
        id: 'dr-requests',
        title: 'تراكم في الطلبات الجديدة',
        note: `${metrics.pendingRequests} طلبًا بانتظار المعالجة الأولية`,
        href: '/requests',
        level: 'critical',
      });
    }

    if (metrics.pendingReturns > 0) {
      items.push({
        id: 'dr-returns',
        title: 'إرجاعات معلقة',
        note: `${metrics.pendingReturns} حالة تحتاج استلامًا وتوثيقًا`,
        href: '/returns',
        level: 'warning',
      });
    }

    if (metrics.lowStock > 0) {
      items.push({
        id: 'dr-stock',
        title: 'مواد منخفضة المخزون',
        note: `${metrics.lowStock} صنفًا يحتاج قرار دعم أو إحلال`,
        href: '/inventory',
        level: 'warning',
      });
    }

    return items.slice(0, 8);
  }, [metrics]);

  const auditFeed = useMemo<FeedItem[]>(() => {
    return auditLogs.slice(0, 6).map((item) => ({
      id: item.id,
      title: item.action || 'إجراء مسجل',
      note: `${item.user?.fullName || 'غير معروف'} — ${getRelativeTime(item.createdAt)}`,
      href: '/audit-logs',
      level: 'normal',
    }));
  }, [auditLogs]);

  const managerMetrics: Metric[] = [
    {
      title: 'طلبات الصيانة',
      value: metrics.maintenancePending,
      note: 'طلبات صيانة تنتظر قرار المدير أو تحويلها للخدمات المساندة',
      href: '/maintenance',
      icon: 'maintenance',
      level: metrics.maintenancePending > 0 ? 'critical' : 'normal',
    },
    {
      title: 'طلبات النظافة',
      value: metrics.cleaningPending,
      note: 'طلبات مرتبطة بنظافة المبنى أو تحسين بيئة البرامج التدريبية',
      href: '/suggestions?category=CLEANING',
      icon: 'cleaning',
      level: metrics.cleaningPending > 0 ? 'warning' : 'normal',
    },
    {
      title: 'طلبات الشراء المباشر',
      value: metrics.purchasePending,
      note: 'طلبات تحتاج اعتمادًا قبل إعداد مسودة البريد المالية',
      href: '/purchases',
      icon: 'purchase',
      level: metrics.purchasePending > 0 ? 'warning' : 'normal',
    },
    {
      title: 'الطلبات الأخرى',
      value: metrics.otherPending,
      note: 'طلبات تحتاج توجيهًا وتحديد الجهة المستفيدة',
      href: '/suggestions?category=OTHER',
      icon: 'other',
      level: metrics.otherPending > 0 ? 'normal' : 'normal',
    },
    {
      title: 'الإرجاعات المعلقة',
      value: metrics.pendingReturns,
      note: 'إرجاعات لم تُغلق بعد',
      href: '/returns',
      icon: 'returns',
      level: metrics.pendingReturns > 0 ? 'warning' : 'normal',
    },
    {
      title: 'مواد منخفضة المخزون',
      value: metrics.lowStock,
      note: 'تحتاج قرار دعم أو إعادة توزيع',
      href: '/inventory',
      icon: 'inventory',
      level: metrics.lowStock > 0 ? 'warning' : 'normal',
    },
  ];

  const shortcuts: Shortcut[] = [
    { title: 'طلبات الصيانة', href: '/maintenance', icon: 'maintenance', note: 'مراجعة واعتماد' },
    { title: 'طلبات النظافة', href: '/suggestions?category=CLEANING', icon: 'cleaning', note: 'متابعة بيئة التشغيل' },
    { title: 'الشراء المباشر', href: '/purchases', icon: 'purchase', note: 'اعتماد وتحويل للمالية' },
    { title: 'الطلبات الأخرى', href: '/suggestions?category=OTHER', icon: 'other', note: 'توجيه وتحديد الجهة' },
    { title: 'المخزون', href: '/inventory', icon: 'inventory', note: 'التوفر والحركة' },
    { title: 'المستخدمون', href: '/users', icon: 'users', note: 'الأدوار والصلاحيات' },
  ];

  return (
    <div className="space-y-6">
      <Hero
        badge="لوحة المدير"
        title={fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
        subtitle="لوحة قرار وتشغيل: أين طلبات الصيانة والنظافة والشراء والطلبات الأخرى، وما الذي يحتاج تدخلًا إداريًا الآن."
        stats={[
          { label: 'طلبات تشغيلية بانتظارك', value: metrics.operationalPending, icon: 'requests' },
          { label: 'طلبات صيانة', value: metrics.maintenancePending, icon: 'maintenance' },
          { label: 'طلبات شراء مباشر', value: metrics.purchasePending, icon: 'purchase' },
          { label: 'تنبيهات حرجة', value: metrics.criticalAlerts, icon: 'warning' },
        ]}
      />

      <MetricGrid items={managerMetrics} />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ShellCard>
          <SectionHeader title="أين القرار الآن" note="العناصر التي تعطي المدير صورة واضحة عن موضع التدخل." href="/maintenance" action="فتح التشغيل" />
          <FeedList items={decisionFeed} emptyText="لا توجد مؤشرات حرجة حالية" />
        </ShellCard>

        <div className="grid gap-4">
          <ShortcutGrid items={shortcuts} title="اختصارات المدير" note="أهم المسارات لاتخاذ القرار والمتابعة." />
          <ShellCard>
            <SectionHeader title="آخر ما سُجل رقابيًا" note="معاينة سريعة لأحدث السجلات ذات الأثر." href="/audit-logs" action="سجل التدقيق" />
            <FeedList items={auditFeed} emptyText="لا توجد سجلات حديثة" />
          </ShellCard>
        </div>
      </section>

      <ShellCard>
        <SectionHeader title="المتابعة العامة" note="تبقى مؤشرات المواد والإرجاعات تحت المتابعة من نفس اللوحة." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            { title: 'الطلبات المعلقة', value: metrics.pendingRequests, href: '/requests', icon: 'requests', note: 'طلبات المواد تنتظر المعالجة', level: metrics.pendingRequests > 0 ? 'critical' : 'normal' as Level },
            { title: 'طلبات معتمدة غير منفذة', value: metrics.approvedNotIssued, href: '/requests', icon: 'trend', note: 'اعتمدت ولم تصل إلى التنفيذ بعد', level: metrics.approvedNotIssued > 0 ? 'warning' : 'normal' as Level },
            { title: 'العهد المتأخرة', value: metrics.overdueCustody, href: '/custody', icon: 'custody', note: 'عهد تستحق متابعة إدارية', level: metrics.overdueCustody > 0 ? 'critical' : 'normal' as Level },
            { title: 'العمليات المنفذة اليوم', value: metrics.todayOps, href: '/audit-logs', icon: 'audit', note: 'نبض التنفيذ اليومي المسجل', level: 'normal' as Level },
          ].map((item) => {
            const tone = getTone(item.level);
            return (
              <Link href={item.href} key={item.title}>
                <div className={`rounded-[24px] border p-5 ${tone.border} ${tone.surface}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[13px] text-slate-600">{item.title}</div>
                      <div className="mt-3 text-[32px] leading-none text-slate-900">{item.value}</div>
                      <div className="mt-3 text-[12px] leading-6 text-slate-600">{item.note}</div>
                    </div>
                    <div className={`rounded-[18px] p-3 ${tone.badge}`}>
                      <Icon name={item.icon} className="h-5 w-5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </ShellCard>
    </div>
  );
}

function WarehouseDashboard({ fullName }: { fullName?: string }) {
  const [requests, setRequests] = useState<GenericRecord[]>([]);
  const [inventory, setInventory] = useState<GenericRecord[]>([]);
  const [returns, setReturns] = useState<GenericRecord[]>([]);
  const [custody, setCustody] = useState<GenericRecord[]>([]);
  const [notifications, setNotifications] = useState<GenericRecord[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [requestsRes, inventoryRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/inventory?limit=200', { cache: 'no-store' }),
      ]);
      const requestsJson = await requestsRes.json().catch(() => null);
      const inventoryJson = await inventoryRes.json().catch(() => null);
      if (!active) return;
      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setInventory(Array.isArray(inventoryJson?.data) ? inventoryJson.data : []);
      setReturns(readStorageArray(RETURNS_STORAGE_KEY));
      setCustody(readStorageArray(CUSTODY_STORAGE_KEY));
      setNotifications(readStorageArray(NOTIFICATIONS_STORAGE_KEY));
    })();
    return () => {
      active = false;
    };
  }, []);

  const stats = useMemo(() => {
    return {
      newRequests: requests.filter((item) => item.status === 'PENDING').length,
      readyToIssue: requests.filter((item) => item.status === 'APPROVED').length,
      pendingReturns: returns.filter((item) => item.status === 'PENDING').length,
      lowStock: inventory.filter((item) => item.status === 'LOW_STOCK').length,
      outOfStock: inventory.filter((item) => item.status === 'OUT_OF_STOCK').length,
      overdue: custody.filter((item) => item.status === 'OVERDUE' || getDaysLate(item.dueDate) > 0).length,
      unreadAlerts: notifications.filter((item) => !item.isRead && (item.kind === 'alert' || item.severity === 'critical')).length,
    };
  }, [requests, returns, inventory, custody, notifications]);

  return (
    <div className="space-y-6">
      <Hero
        badge="لوحة مسؤول المخزن"
        title={fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
        subtitle="رؤية سريعة لما يحتاج التنفيذ الآن داخل المخزون، الطلبات، والإرجاعات."
        stats={[
          { label: 'طلبات جديدة', value: stats.newRequests, icon: 'requests' },
          { label: 'جاهزة للصرف', value: stats.readyToIssue, icon: 'inventory' },
          { label: 'إرجاعات معلقة', value: stats.pendingReturns, icon: 'returns' },
          { label: 'تنبيهات المخزون', value: stats.lowStock + stats.outOfStock, icon: 'warning' },
        ]}
      />

      <MetricGrid
        items={[
          { title: 'طلبات جديدة بانتظار التجهيز', value: stats.newRequests, note: 'تحتاج معالجة مباشرة', href: '/requests', icon: 'requests', level: stats.newRequests > 0 ? 'critical' : 'normal' },
          { title: 'طلبات جاهزة للصرف', value: stats.readyToIssue, note: 'اعتمدت وتحتاج تنفيذًا', href: '/requests', icon: 'inventory', level: stats.readyToIssue > 0 ? 'warning' : 'normal' },
          { title: 'إرجاعات بانتظار الاستلام', value: stats.pendingReturns, note: 'تحتاج استلامًا وتوثيقًا', href: '/returns', icon: 'returns', level: stats.pendingReturns > 0 ? 'warning' : 'normal' },
          { title: 'تنبيهات انخفاض المخزون', value: stats.lowStock + stats.outOfStock, note: 'أصناف تحتاج دعمًا أو شراء', href: '/inventory', icon: 'warning', level: stats.lowStock + stats.outOfStock > 0 ? 'warning' : 'normal' },
          { title: 'عهد متأخرة', value: stats.overdue, note: 'مواد تحتاج متابعة إدارية', href: '/custody', icon: 'custody', level: stats.overdue > 0 ? 'critical' : 'normal' },
          { title: 'إشعارات غير مقروءة', value: stats.unreadAlerts, note: 'تنبيهات تشغيلية بانتظار الاطلاع', href: '/notifications', icon: 'notifications', level: stats.unreadAlerts > 0 ? 'warning' : 'normal' },
        ]}
      />
    </div>
  );
}

function UserDashboard({ fullName, userId }: { fullName?: string; userId?: string }) {
  const [requests, setRequests] = useState<GenericRecord[]>([]);
  const [suggestions, setSuggestions] = useState<GenericRecord[]>([]);
  const [returns, setReturns] = useState<GenericRecord[]>([]);
  const [custody, setCustody] = useState<GenericRecord[]>([]);
  const [notifications, setNotifications] = useState<GenericRecord[]>([]);

  useEffect(() => {
    let active = true;
    (async () => {
      const [requestsRes, suggestionsRes] = await Promise.all([
        fetch('/api/requests', { cache: 'no-store' }),
        fetch('/api/suggestions', { cache: 'no-store' }).catch(() => null),
      ]);
      const requestsJson = await requestsRes.json().catch(() => null);
      const suggestionsJson = suggestionsRes ? await suggestionsRes.json().catch(() => null) : null;
      if (!active) return;
      setRequests(Array.isArray(requestsJson?.data) ? requestsJson.data : []);
      setSuggestions(Array.isArray(suggestionsJson?.data) ? suggestionsJson.data : []);
      setReturns(readStorageArray(RETURNS_STORAGE_KEY));
      setCustody(readStorageArray(CUSTODY_STORAGE_KEY));
      setNotifications(readStorageArray(NOTIFICATIONS_STORAGE_KEY));
    })();
    return () => {
      active = false;
    };
  }, []);

  const myRequests = useMemo(() => requests.filter((item) => !userId || item.requesterId === userId), [requests, userId]);
  const mySuggestions = useMemo(() => suggestions.filter((item) => !userId || item.requesterId === userId), [suggestions, userId]);
  const myReturns = useMemo(() => returns.filter((item) => !userId || item.userId === userId || item.requesterId === userId), [returns, userId]);
  const myCustody = useMemo(() => custody.filter((item) => !userId || item.assignedToUserId === userId), [custody, userId]);
  const visibleNotifications = useMemo(() => notifications.filter(() => true), [notifications]);

  const stats = useMemo(() => {
    return {
      openRequests: myRequests.filter((item) => item.status === 'PENDING' || item.status === 'APPROVED').length,
      activeCustody: myCustody.filter((item) => item.status !== 'RETURNED').length,
      pendingReturns: myReturns.filter((item) => item.status === 'PENDING').length,
      unreadNotifications: visibleNotifications.filter((item) => !item.isRead).length,
      overdueCustody: myCustody.filter((item) => item.status === 'OVERDUE' || getDaysLate(item.dueDate) > 0).length,
      openOtherRequests: mySuggestions.filter((item) => item.status === 'PENDING' || item.status === 'UNDER_REVIEW').length,
    };
  }, [myRequests, myCustody, myReturns, visibleNotifications, mySuggestions]);

  const currentFeed = useMemo<FeedItem[]>(() => {
    return [
      ...visibleNotifications.slice(0, 3).map((item) => ({
        id: `not-${item.id}`,
        title: item.title,
        note: item.message,
        href: '/notifications',
        level: item.severity === 'critical' ? 'critical' : item.kind === 'alert' ? 'warning' : 'normal',
      })),
      ...myCustody
        .filter((item) => item.status === 'OVERDUE' || getDaysLate(item.dueDate) > 0)
        .slice(0, 2)
        .map((item) => ({
          id: `cus-${item.id}`,
          title: 'لديك عهدة متأخرة',
          note: `${item.itemName} — ${getDaysLate(item.dueDate)} يوم تأخير`,
          href: '/custody',
          level: 'critical' as Level,
        })),
      ...myReturns
        .filter((item) => item.status === 'PENDING')
        .slice(0, 2)
        .map((item) => ({
          id: `ret-${item.id}`,
          title: 'طلب إرجاع بانتظار الاستلام',
          note: `${item.code || item.id} — ${item.custody?.item?.name || 'مادة مرتبطة'}`,
          href: '/returns',
          level: 'warning' as Level,
        })),
    ].slice(0, 6);
  }, [visibleNotifications, myCustody, myReturns]);

  return (
    <div className="space-y-6">
      <Hero
        badge="بوابة الموظف"
        title={fullName ? `مرحبًا ${fullName}` : 'مرحبًا بك'}
        subtitle="من هنا تبدأ كل احتياجاتك بوضوح: طلب مواد، إرجاع، صيانة، نظافة، شراء مباشر، أو أي طلب آخر."
        stats={[
          { label: 'طلباتي المفتوحة', value: stats.openRequests + stats.openOtherRequests, icon: 'requests' },
          { label: 'مواد بعهدتي', value: stats.activeCustody, icon: 'custody' },
          { label: 'إرجاعات معلقة', value: stats.pendingReturns, icon: 'returns' },
          { label: 'إشعارات جديدة', value: stats.unreadNotifications, icon: 'notifications' },
        ]}
      />

      <ShellCard>
        <SectionHeader title="ماذا تريد أن تنجز اليوم؟" note="اختر المسار الصحيح مباشرة دون حيرة أو تنقل عشوائي." />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { title: 'طلب مواد', note: 'لصرف مواد متوفرة من المخزون', href: '/requests?new=1', icon: 'requests', tone: 'primary' as Level },
            { title: 'طلب إرجاع مواد', note: 'لإرجاع المواد القابلة للإعادة من عهدتك', href: '/returns?new=1', icon: 'returns', tone: 'secondary' as Level },
            { title: 'طلب صيانة', note: 'عند وجود عطل أو خلل في مادة أو تجهيز', href: '/suggestions?new=1&type=MAINTENANCE', icon: 'maintenance', tone: 'normal' as Level },
            { title: 'طلب نظافة', note: 'لاحتياج تنظيف أو معالجة بيئة تشغيل', href: '/suggestions?new=1&type=CLEANING', icon: 'cleaning', tone: 'normal' as Level },
            { title: 'طلب شراء مباشر', note: 'عند الحاجة إلى صنف غير متوفر أو غير كافٍ', href: '/suggestions?new=1&type=PURCHASE', icon: 'purchase', tone: 'normal' as Level },
            { title: 'طلبات أخرى', note: 'لأي احتياج لا يندرج ضمن المسارات السابقة', href: '/suggestions?new=1&type=OTHER', icon: 'other', tone: 'normal' as Level },
          ].map((item) => {
            const tone = getTone(item.tone);
            return (
              <Link key={item.title} href={item.href} className={`group rounded-[24px] border p-5 transition hover:-translate-y-[2px] hover:shadow-lg ${tone.border} ${tone.surface}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className={`rounded-[18px] p-3 ${tone.badge}`}>
                    <Icon name={item.icon} className="h-6 w-6" />
                  </div>
                  <Icon name="arrow" className={`h-4 w-4 transition ${tone.arrow} group-hover:scale-110`} />
                </div>
                <div className="mt-4 text-[18px] text-slate-900">{item.title}</div>
                <div className="mt-2 text-[13px] leading-7 text-slate-600">{item.note}</div>
              </Link>
            );
          })}
        </div>
      </ShellCard>

      <MetricGrid
        items={[
          { title: 'طلباتي المفتوحة', value: stats.openRequests + stats.openOtherRequests, note: 'طلبات ما زالت تحت الإجراء أو بانتظار التنفيذ', href: '/requests', icon: 'requests', level: stats.openRequests + stats.openOtherRequests > 0 ? 'warning' : 'normal' },
          { title: 'عهدتي الحالية', value: stats.activeCustody, note: 'مواد ما زالت بعهدتك ولم تغلق بعد', href: '/custody', icon: 'custody', level: 'normal' },
          { title: 'طلبات إرجاع معلقة', value: stats.pendingReturns, note: 'طلبات أرسلتها وما زالت بانتظار الاستلام', href: '/returns', icon: 'returns', level: stats.pendingReturns > 0 ? 'warning' : 'normal' },
          { title: 'إشعارات جديدة', value: stats.unreadNotifications, note: 'اعتمادات أو ملاحظات أو تحديثات على طلباتك', href: '/notifications', icon: 'notifications', level: stats.unreadNotifications > 0 ? 'critical' : 'normal' },
        ]}
      />

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <ShellCard>
          <SectionHeader title="وضعك الحالي" note="أهم ما يحتاج منك متابعة أو ينتظر ردًا أو استلامًا." href="/notifications" action="كل التحديثات" />
          <FeedList items={currentFeed} emptyText="لا توجد مستجدات حالية" />
        </ShellCard>
        <ShortcutGrid
          title="اختصارات سريعة"
          note="المسارات الأكثر استخدامًا في العمل اليومي."
          items={[
            { title: 'طلباتي', href: '/requests', icon: 'requests' },
            { title: 'عهدتي', href: '/custody', icon: 'custody' },
            { title: 'الإرجاعات', href: '/returns', icon: 'returns' },
            { title: 'الطلبات الأخرى', href: '/suggestions', icon: 'other' },
          ]}
        />
      </section>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const role = (user?.role || 'user').toLowerCase();

  if (role === 'manager') {
    return <ManagerDashboard fullName={user?.fullName} />;
  }

  if (role === 'warehouse') {
    return <WarehouseDashboard fullName={user?.fullName} />;
  }

  return <UserDashboard fullName={user?.fullName} userId={user?.id} />;
}
