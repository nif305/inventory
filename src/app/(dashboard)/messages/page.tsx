'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { useAuth } from '@/context/AuthContext';
import { createNotification } from '@/lib/notifications';

type MessageBox = 'inbox' | 'sent';

type RelatedType =
  | 'REQUEST'
  | 'RETURN'
  | 'CUSTODY'
  | 'MAINTENANCE'
  | 'PURCHASE'
  | 'OTHER';

type StoredMessage = {
  id: string;
  threadId: string;
  parentMessageId?: string | null;
  senderId: string;
  receiverId: string;
  subject: string;
  body: string;
  relatedType?: RelatedType | null;
  relatedId?: string | null;
  isRead: boolean;
  createdAt: string;
};

type MessageItem = StoredMessage & {
  senderName?: string;
  receiverName?: string;
  senderRole?: string;
  receiverRole?: string;
};

type ThreadSummary = {
  threadId: string;
  subject: string;
  relatedType?: RelatedType | null;
  relatedId?: string | null;
  lastMessageAt: string;
  unreadCount: number;
  lastMessagePreview: string;
  otherPartyName: string;
  boxType: MessageBox;
};

const MESSAGES_STORAGE_KEY = 'inventory_internal_messages';
const MESSAGES_UPDATED_EVENT = 'inventory-messages-updated';

const relatedTypeLabels: Record<RelatedType, string> = {
  REQUEST: 'طلب مواد',
  RETURN: 'إرجاع',
  CUSTODY: 'عهدة',
  MAINTENANCE: 'صيانة',
  PURCHASE: 'شراء مباشر',
  OTHER: 'طلب آخر',
};

function formatDate(date?: string) {
  if (!date) return '-';
  try {
    return new Date(date).toLocaleString('ar-SA');
  } catch {
    return date;
  }
}

function relatedBadgeClass(type?: RelatedType | null) {
  if (type === 'REQUEST') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
  if (type === 'RETURN') return 'bg-amber-100 text-amber-700 border-amber-200';
  if (type === 'CUSTODY') return 'bg-blue-100 text-blue-700 border-blue-200';
  if (type === 'MAINTENANCE') return 'bg-red-100 text-red-700 border-red-200';
  if (type === 'PURCHASE') return 'bg-amber-100 text-amber-700 border-amber-200';
  return 'bg-gray-100 text-gray-700 border-gray-200';
}

function loadMessages(): StoredMessage[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(MESSAGES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMessages(messages: StoredMessage[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
  window.dispatchEvent(new CustomEvent(MESSAGES_UPDATED_EVENT));
}

function pushMessageNotification(
  userId: string,
  title: string,
  message: string,
  threadId: string,
  dedupeKey: string,
) {
  createNotification({
    userId,
    kind: 'notification',
    severity: 'info',
    title,
    message,
    link: `/messages?open=${threadId}`,
    entityType: 'message',
    entityId: threadId,
    dedupeKey,
  });
}

export default function MessagesPage() {
  const searchParams = useSearchParams();
  const { user, allUsers } = useAuth();

  const [activeBox, setActiveBox] = useState<MessageBox>('inbox');
  const [threads, setThreads] = useState<ThreadSummary[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<MessageItem[]>([]);
  const [isComposeOpen, setIsComposeOpen] = useState(false);

  const [receiverId, setReceiverId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [relatedType, setRelatedType] = useState<RelatedType | ''>('');
  const [relatedId, setRelatedId] = useState('');
  const [error, setError] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyError, setReplyError] = useState('');

  const recipients = useMemo(() => {
    const seen = new Set<string>();
    return allUsers.filter((item) => {
      if (item.id === user?.id || item.status !== 'active') return false;
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
  }, [allUsers, user?.id]);

  const hydrateThreadMessages = (threadId: string) => {
    if (!user?.id) return;

    const stored = loadMessages()
      .filter((msg) => msg.threadId === threadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const hydrated: MessageItem[] = stored.map((msg) => {
      const sender = allUsers.find((u) => u.id === msg.senderId);
      const receiver = allUsers.find((u) => u.id === msg.receiverId);

      return {
        ...msg,
        senderName: sender?.fullName || 'مستخدم غير معروف',
        receiverName: receiver?.fullName || 'مستخدم غير معروف',
        senderRole: sender?.role || '',
        receiverRole: receiver?.role || '',
      };
    });

    const updated = loadMessages().map((msg) => {
      if (msg.threadId === threadId && msg.receiverId === user.id && !msg.isRead) {
        return { ...msg, isRead: true };
      }
      return msg;
    });

    saveMessages(updated);
    setThreadMessages(hydrated);
    setSelectedThreadId(threadId);
  };

  const hydrateThreads = () => {
    if (!user?.id) return;

    const stored = loadMessages();
    const visible =
      activeBox === 'inbox'
        ? stored.filter((msg) => msg.receiverId === user.id)
        : stored.filter((msg) => msg.senderId === user.id);

    const map = new Map<string, StoredMessage[]>();

    for (const msg of visible) {
      const arr = map.get(msg.threadId) || [];
      arr.push(msg);
      map.set(msg.threadId, arr);
    }

    const summaries: ThreadSummary[] = Array.from(map.entries()).map(([threadId, msgs]) => {
      const sorted = [...msgs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const latest = sorted[0];
      const unreadCount =
        activeBox === 'inbox'
          ? msgs.filter((m) => !m.isRead && m.receiverId === user.id).length
          : 0;

      const otherPartyId = activeBox === 'inbox' ? latest.senderId : latest.receiverId;
      const otherParty = allUsers.find((u) => u.id === otherPartyId);

      return {
        threadId,
        subject: latest.subject,
        relatedType: latest.relatedType || null,
        relatedId: latest.relatedId || null,
        lastMessageAt: latest.createdAt,
        unreadCount,
        lastMessagePreview: latest.body,
        otherPartyName: otherParty?.fullName || 'مستخدم غير معروف',
        boxType: activeBox,
      };
    });

    summaries.sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    setThreads(summaries);

    if (selectedThreadId) {
      const exists = summaries.some((t) => t.threadId === selectedThreadId);
      if (!exists) {
        setSelectedThreadId(null);
        setThreadMessages([]);
      }
    }
  };

  useEffect(() => {
    hydrateThreads();

    const refresh = () => hydrateThreads();
    window.addEventListener(MESSAGES_UPDATED_EVENT, refresh);
    window.addEventListener('storage', refresh);

    return () => {
      window.removeEventListener(MESSAGES_UPDATED_EVENT, refresh);
      window.removeEventListener('storage', refresh);
    };
  }, [activeBox, user?.id, allUsers.length]);

  useEffect(() => {
    const openThreadId = searchParams.get('open');
    if (!openThreadId || !user?.id) return;

    const stored = loadMessages();
    const canOpen = stored.some(
      (msg) =>
        msg.threadId === openThreadId &&
        (msg.receiverId === user.id || msg.senderId === user.id),
    );

    if (!canOpen) return;

    const isInboxThread = stored.some(
      (msg) => msg.threadId === openThreadId && msg.receiverId === user.id,
    );

    const nextBox: MessageBox = isInboxThread ? 'inbox' : 'sent';
    setActiveBox(nextBox);
    setSelectedThreadId(openThreadId);

    setTimeout(() => {
      hydrateThreadMessages(openThreadId);
    }, 0);
  }, [searchParams, user?.id, allUsers.length]);

  const unreadCount = useMemo(() => {
    return threads.reduce((sum, thread) => sum + thread.unreadCount, 0);
  }, [threads]);

  const selectedThreadSummary = useMemo(
    () => threads.find((t) => t.threadId === selectedThreadId) || null,
    [threads, selectedThreadId],
  );

  const handleSendNew = () => {
    setError('');

    if (!user?.id) {
      setError('تعذر تحديد المستخدم الحالي.');
      return;
    }

    if (!receiverId || !subject.trim() || !body.trim()) {
      setError('يرجى استكمال المستلم والموضوع ونص الرسالة.');
      return;
    }

    const receiver = allUsers.find((u) => u.id === receiverId && u.status === 'active');
    if (!receiver) {
      setError('المستلم غير صالح أو غير نشط.');
      return;
    }

    const threadId = `thr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const newMessage: StoredMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      threadId,
      parentMessageId: null,
      senderId: user.id,
      receiverId,
      subject: subject.trim(),
      body: body.trim(),
      relatedType: relatedType || null,
      relatedId: relatedId.trim() || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    saveMessages([newMessage, ...loadMessages()]);

    pushMessageNotification(
      receiverId,
      'رسالة داخلية جديدة',
      `وردتك رسالة جديدة بعنوان: ${subject.trim()}`,
      threadId,
      `message:new:${threadId}:${receiverId}`,
    );

    setReceiverId('');
    setSubject('');
    setBody('');
    setRelatedType('');
    setRelatedId('');
    setError('');
    setIsComposeOpen(false);
    setActiveBox('sent');
    setSelectedThreadId(threadId);
    hydrateThreads();
    hydrateThreadMessages(threadId);
  };

  const handleReply = () => {
    setReplyError('');

    if (!user?.id) {
      setReplyError('تعذر تحديد المستخدم الحالي.');
      return;
    }

    if (!selectedThreadId) {
      setReplyError('تعذر تحديد المحادثة.');
      return;
    }

    if (!replyBody.trim()) {
      setReplyError('اكتب نص الرد أولًا.');
      return;
    }

    const stored = loadMessages()
      .filter((msg) => msg.threadId === selectedThreadId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    const lastMessage = stored[stored.length - 1];

    if (!lastMessage) {
      setReplyError('تعذر العثور على الرسالة الأصلية.');
      return;
    }

    const targetReceiverId =
      lastMessage.senderId === user.id ? lastMessage.receiverId : lastMessage.senderId;

    const receiver = allUsers.find((u) => u.id === targetReceiverId && u.status === 'active');
    if (!receiver) {
      setReplyError('المستلم غير صالح أو غير نشط.');
      return;
    }

    const replyMessage: StoredMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      threadId: selectedThreadId,
      parentMessageId: lastMessage.id,
      senderId: user.id,
      receiverId: targetReceiverId,
      subject: lastMessage.subject,
      body: replyBody.trim(),
      relatedType: lastMessage.relatedType || null,
      relatedId: lastMessage.relatedId || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };

    saveMessages([replyMessage, ...loadMessages()]);

    pushMessageNotification(
      targetReceiverId,
      'رد جديد على مراسلة داخلية',
      `وردك رد جديد بعنوان: ${lastMessage.subject}`,
      selectedThreadId,
      `message:reply:${replyMessage.id}:${targetReceiverId}`,
    );

    setReplyBody('');
    setReplyError('');
    hydrateThreads();
    hydrateThreadMessages(selectedThreadId);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-surface-border bg-white p-5 shadow-soft">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-[30px] leading-[1.25] text-primary">المراسلات الداخلية</h1>
            <p className="mt-2 text-[14px] leading-7 text-surface-subtle">
              تواصل داخلي تفاعلي موثّق بين المدير ومسؤول المخزن والموظفين، مع الرد المباشر داخل نفس المحادثة.
            </p>
          </div>

          <Button
            onClick={() => {
              setIsComposeOpen(true);
              setError('');
            }}
          >
            رسالة جديدة
          </Button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-[22px] border border-surface-border bg-slate-50 p-4">
            <div className="text-[13px] text-surface-subtle">إجمالي المحادثات</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">{threads.length}</div>
          </div>

          <div className="rounded-[22px] border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-[13px] text-emerald-700">غير المقروء</div>
            <div className="mt-2 text-[32px] leading-none text-slate-900">
              {activeBox === 'inbox' ? unreadCount : '-'}
            </div>
          </div>

          <div className="rounded-[22px] border border-surface-border bg-slate-50 p-4">
            <div className="text-[13px] text-surface-subtle">الصندوق الحالي</div>
            <div className="mt-2 text-[18px] leading-none text-slate-900">
              {activeBox === 'inbox' ? 'الوارد' : 'المرسل'}
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            onClick={() => {
              setActiveBox('inbox');
              setSelectedThreadId(null);
              setThreadMessages([]);
            }}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeBox === 'inbox'
                ? 'bg-[#016564] text-white'
                : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            الوارد
          </button>

          <button
            onClick={() => {
              setActiveBox('sent');
              setSelectedThreadId(null);
              setThreadMessages([]);
            }}
            className={`rounded-full px-4 py-2 text-sm transition ${
              activeBox === 'sent'
                ? 'bg-[#016564] text-white'
                : 'border border-slate-200 bg-white text-slate-700'
            }`}
          >
            المرسل
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="rounded-[28px] border border-surface-border p-4 shadow-soft">
          <div className="mb-3 text-[18px] text-primary">المحادثات</div>

          <div className="space-y-3">
            {threads.length === 0 ? (
              <div className="rounded-[18px] bg-slate-50 p-6 text-center text-sm text-slate-500">
                لا توجد محادثات في هذا الصندوق
              </div>
            ) : (
              threads.map((thread, index) => (
                <button
                  key={`${thread.threadId}-${thread.boxType}-${index}`}
                  onClick={() => hydrateThreadMessages(thread.threadId)}
                  className={`w-full rounded-[20px] border p-4 text-right transition ${
                    selectedThreadId === thread.threadId
                      ? 'border-primary bg-surface'
                      : 'border-surface-border bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {thread.relatedType ? (
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] leading-none ${relatedBadgeClass(thread.relatedType)}`}
                      >
                        {relatedTypeLabels[thread.relatedType]}
                      </span>
                    ) : null}

                    {thread.unreadCount > 0 ? (
                      <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] leading-none text-amber-700">
                        {thread.unreadCount} جديدة
                      </span>
                    ) : null}
                  </div>

                  <div className="text-[15px] text-slate-900">{thread.subject}</div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    {activeBox === 'inbox'
                      ? `من: ${thread.otherPartyName}`
                      : `إلى: ${thread.otherPartyName}`}
                  </div>
                  <div className="mt-2 line-clamp-2 text-[13px] leading-6 text-slate-600">
                    {thread.lastMessagePreview}
                  </div>
                  <div className="mt-2 text-[11px] text-slate-400">
                    {formatDate(thread.lastMessageAt)}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>

        <Card className="rounded-[28px] border border-surface-border p-4 shadow-soft">
          {!selectedThreadSummary ? (
            <div className="flex min-h-[420px] items-center justify-center text-center text-slate-500">
              اختر محادثة من القائمة لعرض الرسائل والرد عليها مباشرة
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-[20px] border border-surface-border bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {selectedThreadSummary.relatedType ? (
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] leading-none ${relatedBadgeClass(selectedThreadSummary.relatedType)}`}
                    >
                      {relatedTypeLabels[selectedThreadSummary.relatedType]}
                    </span>
                  ) : null}

                  {selectedThreadSummary.relatedId ? (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-[11px] leading-none text-gray-700">
                      {selectedThreadSummary.relatedId}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 text-[20px] text-primary">{selectedThreadSummary.subject}</div>
              </div>

              <div className="max-h-[420px] space-y-3 overflow-y-auto rounded-[20px] border border-surface-border bg-white p-3">
                {threadMessages.map((msg) => {
                  const mine = msg.senderId === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                      <div
                        className={`max-w-[78%] rounded-[20px] px-4 py-3 text-right ${
                          mine
                            ? 'bg-[#016564] text-white'
                            : 'border border-surface-border bg-slate-50 text-slate-800'
                        }`}
                      >
                        <div className={`text-[12px] ${mine ? 'text-white/80' : 'text-slate-500'}`}>
                          {msg.senderName} — {formatDate(msg.createdAt)}
                        </div>
                        <div className="mt-2 whitespace-pre-wrap text-[14px] leading-8">
                          {msg.body}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-[20px] border border-surface-border bg-slate-50 p-4">
                <label className="mb-2 block text-sm text-primary">رد سريع</label>
                <textarea
                  rows={4}
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  className="w-full rounded-xl border border-surface-border bg-white p-3"
                  placeholder="اكتب ردك هنا"
                />

                {replyError ? (
                  <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {replyError}
                  </div>
                ) : null}

                <div className="mt-3 flex justify-end">
                  <Button onClick={handleReply}>إرسال الرد</Button>
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal
        isOpen={isComposeOpen}
        onClose={() => {
          setIsComposeOpen(false);
          setError('');
        }}
        title="رسالة داخلية جديدة"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-2 block text-sm text-primary">المستلم</label>
            <select
              value={receiverId}
              onChange={(e) => setReceiverId(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="">اختر المستلم</option>
              {recipients.map((item, index) => (
                <option key={`${item.id}-${index}`} value={item.id}>
                  {item.fullName} —{' '}
                  {item.role === 'manager'
                    ? 'مدير'
                    : item.role === 'warehouse'
                      ? 'مسؤول مخزن'
                      : 'موظف'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">نوع الارتباط</label>
            <select
              value={relatedType}
              onChange={(e) => setRelatedType(e.target.value as RelatedType | '')}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
            >
              <option value="">بدون ربط</option>
              <option value="REQUEST">طلب مواد</option>
              <option value="RETURN">إرجاع</option>
              <option value="CUSTODY">عهدة</option>
              <option value="MAINTENANCE">صيانة</option>
              <option value="PURCHASE">شراء مباشر</option>
              <option value="OTHER">طلب آخر</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">الرقم المرجعي</label>
            <input
              value={relatedId}
              onChange={(e) => setRelatedId(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              placeholder="مثال: REQ-4012"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">الموضوع</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-xl border border-surface-border bg-white p-3"
              placeholder="اكتب موضوع الرسالة"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-primary">نص الرسالة</label>
            <textarea
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full rounded-xl border border-surface-border p-3"
              placeholder="اكتب نص الرسالة"
            />
          </div>

          {error ? (
            <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsComposeOpen(false);
                setError('');
              }}
            >
              إلغاء
            </Button>
            <Button type="button" onClick={handleSendNew}>
              إرسال
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}