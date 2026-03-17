'use client';

import type { AppRole, User } from '@/features/auth/types/auth.types';

export const NOTIFICATIONS_STORAGE_KEY = 'inventory_notifications_v2';
export const LEGACY_NOTIFICATIONS_STORAGE_KEY = 'inventory_notifications';
export const USERS_STORAGE_KEY = 'inventory_users';
export const NOTIFICATIONS_UPDATED_EVENT = 'inventory-notifications-updated';
export const NOTIFICATION_TOAST_EVENT = 'inventory-notification-toast';

export type NotificationKind = 'alert' | 'notification';
export type NotificationSeverity = 'info' | 'action' | 'critical';

export type InventoryNotification = {
  id: string;
  userId: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  isRead: boolean;
  createdAt: string;
  readAt?: string | null;
};

type CreateNotificationInput = {
  userId: string;
  kind: NotificationKind;
  severity: NotificationSeverity;
  title: string;
  message: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  dedupeKey?: string | null;
  silent?: boolean;
};

type BroadcastInput = Omit<CreateNotificationInput, 'userId'> & {
  userIds?: string[];
  roles?: AppRole[];
};

export function isBrowser() {
  return typeof window !== 'undefined';
}

function dispatchNotificationsUpdated() {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_UPDATED_EVENT));
}

function dispatchToast(notification: InventoryNotification) {
  if (!isBrowser()) return;
  window.dispatchEvent(new CustomEvent(NOTIFICATION_TOAST_EVENT, { detail: notification }));
}

export function loadUsers(): User[] {
  if (!isBrowser()) return [];
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function migrateLegacyNotifications() {
  if (!isBrowser()) return;

  const current = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
  if (current) return;

  const legacyRaw = localStorage.getItem(LEGACY_NOTIFICATIONS_STORAGE_KEY);
  if (!legacyRaw) return;

  try {
    const legacy = JSON.parse(legacyRaw);
    if (!Array.isArray(legacy)) return;

    const normalized: InventoryNotification[] = legacy
      .filter((item) => item?.userId && item?.title && item?.message)
      .map((item) => ({
        id: item.id || `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        userId: item.userId,
        kind: item.kind === 'alert' ? 'alert' : 'notification',
        severity:
          item.severity === 'critical' || item.severity === 'action' ? item.severity : 'info',
        title: item.title,
        message: item.message,
        link: item.link || '/notifications',
        entityType: item.entityType || null,
        entityId: item.entityId || null,
        dedupeKey: item.dedupeKey || null,
        isRead: Boolean(item.isRead),
        createdAt: item.createdAt || new Date().toISOString(),
        readAt: item.readAt || null,
      }));

    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore
  }
}

export function loadNotifications(userId?: string): InventoryNotification[] {
  if (!isBrowser()) return [];
  migrateLegacyNotifications();

  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const rows = Array.isArray(parsed) ? parsed : [];
    const filtered = userId ? rows.filter((item) => item.userId === userId) : rows;

    return filtered.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  } catch {
    return [];
  }
}

function saveNotifications(items: InventoryNotification[]) {
  if (!isBrowser()) return;
  localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(items));
  dispatchNotificationsUpdated();
}

function findRecentDuplicate(
  items: InventoryNotification[],
  input: CreateNotificationInput,
  windowMinutes = 720,
) {
  const now = Date.now();
  return items.find((item) => {
    if (item.userId !== input.userId) return false;
    if (!input.dedupeKey || !item.dedupeKey) return false;
    if (item.dedupeKey !== input.dedupeKey) return false;

    const ageMinutes = (now - new Date(item.createdAt).getTime()) / (1000 * 60);
    return ageMinutes <= windowMinutes;
  });
}

export function createNotification(input: CreateNotificationInput) {
  if (!isBrowser()) return null;

  const current = loadNotifications();
  const duplicate = findRecentDuplicate(current, input);
  if (duplicate) return duplicate;

  const item: InventoryNotification = {
    id: `ntf_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    userId: input.userId,
    kind: input.kind,
    severity: input.severity,
    title: input.title,
    message: input.message,
    link: input.link || '/notifications',
    entityType: input.entityType || null,
    entityId: input.entityId || null,
    dedupeKey: input.dedupeKey || null,
    isRead: false,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  saveNotifications([item, ...current]);
  if (!input.silent) dispatchToast(item);
  return item;
}

export function broadcastNotification(input: BroadcastInput) {
  if (!isBrowser()) return [] as InventoryNotification[];

  const users = loadUsers();
  const userIds = new Set<string>(input.userIds || []);

  if (input.roles?.length) {
    users
      .filter((user) => input.roles?.includes(user.role) && user.status === 'active')
      .forEach((user) => userIds.add(user.id));
  }

  return Array.from(userIds)
    .map((userId) =>
      createNotification({
        userId,
        kind: input.kind,
        severity: input.severity,
        title: input.title,
        message: input.message,
        link: input.link,
        entityType: input.entityType,
        entityId: input.entityId,
        dedupeKey: input.dedupeKey ? `${input.dedupeKey}:${userId}` : null,
        silent: input.silent,
      }),
    )
    .filter(Boolean) as InventoryNotification[];
}

export function markNotificationRead(id: string) {
  const items = loadNotifications();
  saveNotifications(
    items.map((item) =>
      item.id === id
        ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }
        : item,
    ),
  );
}

export function markAllNotificationsRead(userId: string) {
  const items = loadNotifications();
  saveNotifications(
    items.map((item) =>
      item.userId === userId && !item.isRead
        ? { ...item, isRead: true, readAt: item.readAt || new Date().toISOString() }
        : item,
    ),
  );
}

export function getUnreadNotificationsCount(userId: string) {
  return loadNotifications(userId).filter((item) => !item.isRead).length;
}

export function syncInventoryAlerts(items: Array<{ id: string; name: string; availableQty: number; status?: string }>) {
  broadcastNotification({
    roles: ['manager', 'warehouse'],
    kind: 'alert',
    severity: 'critical',
    title: 'تنبيه مخزون نافد',
    message: 'يوجد صنف أو أكثر بحالة نافد ويحتاج متابعة فورية.',
    link: '/inventory',
    entityType: 'INVENTORY',
    entityId: 'inventory-out-of-stock',
    dedupeKey: items.some((item) => item.status === 'OUT_OF_STOCK') ? 'inventory-out-of-stock' : null,
    silent: true,
  });

  broadcastNotification({
    roles: ['manager', 'warehouse'],
    kind: 'alert',
    severity: 'action',
    title: 'تنبيه مخزون منخفض',
    message: 'يوجد صنف أو أكثر منخفض المخزون ويحتاج متابعة.',
    link: '/inventory',
    entityType: 'INVENTORY',
    entityId: 'inventory-low-stock',
    dedupeKey: items.some((item) => item.status === 'LOW_STOCK') ? 'inventory-low-stock' : null,
    silent: true,
  });
}
