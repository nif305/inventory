'use client';

import React, { useMemo, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';

type EditableRole = 'manager' | 'warehouse' | 'user';
type EditableStatus = 'active' | 'pending' | 'disabled' | 'rejected' | 'archived';

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

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('ar-SA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    }).format(new Date(value));
  } catch {
    return '—';
  }
}

function roleLabel(role?: string) {
  if (role === 'manager') return 'مدير';
  if (role === 'warehouse') return 'مسؤول مخزن';
  return 'موظف';
}

function statusMeta(status?: string): {
  label: string;
  variant: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
} {
  if (status === 'active') return { label: 'نشط', variant: 'success' };
  if (status === 'pending') return { label: 'بانتظار المراجعة', variant: 'warning' };
  if (status === 'disabled') return { label: 'موقوف', variant: 'danger' };
  if (status === 'rejected') return { label: 'مرفوض', variant: 'danger' };
  if (status === 'archived') return { label: 'مؤرشف', variant: 'neutral' };
  return { label: 'غير معروف', variant: 'neutral' };
}

export default function UsersPage() {
  const {
    allUsers,
    canManageUsers,
    updateUserProfile,
    resetUserPassword,
    setUserMustChangePassword,
    activateUser,
    disableUser,
    archiveUser,
    approveUser,
    rejectUser,
  } = useAuth();

  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [passwordResult, setPasswordResult] = useState<string>('');

  const selectedUser = useMemo(
    () => allUsers.find((user) => user.id === selectedId) || null,
    [allUsers, selectedId]
  );

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [extension, setExtension] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [operationalProject, setOperationalProject] = useState('');
  const [role, setRole] = useState<EditableRole>('user');
  const [status, setStatus] = useState<EditableStatus>('active');
  const [customPassword, setCustomPassword] = useState('');

  const filteredUsers = useMemo(() => {
    const q = normalizeArabic(search);
    return allUsers.filter((user) => {
      const haystack = normalizeArabic(
        [
          user.fullName,
          user.email,
          user.employeeId,
          user.department,
          user.jobTitle,
          user.operationalProject,
        ]
          .filter(Boolean)
          .join(' ')
      );
      return q ? haystack.includes(q) : true;
    });
  }, [allUsers, search]);

  const openEditor = (userId: string) => {
    const user = allUsers.find((item) => item.id === userId);
    if (!user) return;

    setSelectedId(user.id);
    setPasswordResult('');
    setCustomPassword('');
    setFullName(user.fullName || '');
    setEmail(user.email || '');
    setMobile(user.mobile || '');
    setExtension(user.extension || '');
    setDepartment(user.department || '');
    setJobTitle(user.jobTitle || '');
    setOperationalProject(user.operationalProject || '');
    setRole((user.role as EditableRole) || 'user');
    setStatus((user.status as EditableStatus) || 'active');
  };

  const closeEditor = () => {
    setSelectedId(null);
    setPasswordResult('');
    setCustomPassword('');
  };

  const handleSave = () => {
    if (!selectedUser) return;

    const result = updateUserProfile(selectedUser.id, {
      fullName,
      email,
      mobile,
      extension,
      department,
      jobTitle,
      operationalProject,
      role,
      status,
    });

    if (!result.ok) {
      alert(result.message || 'تعذر حفظ التعديلات');
      return;
    }

    alert('تم حفظ بيانات المستخدم');
  };

  const handleResetPassword = () => {
    if (!selectedUser) return;

    const result = resetUserPassword(selectedUser.id, customPassword);
    if (!result.ok) {
      alert(result.message || 'تعذر إعادة تعيين كلمة المرور');
      return;
    }

    setPasswordResult(result.password || '');
    setCustomPassword('');
    alert('تمت إعادة تعيين كلمة المرور بنجاح');
  };

  if (!canManageUsers) {
    return (
      <Card className="rounded-[28px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">
        هذه الصفحة مخصصة للمدير فقط.
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[28px] border border-[#d6d7d4] bg-white px-5 py-5 shadow-sm">
        <div className="space-y-2">
          <h1 className="text-2xl font-extrabold text-[#016564]">إدارة المستخدمين</h1>
          <p className="text-sm text-[#61706f]">
            إدارة فعلية لبيانات المستخدمين، الصلاحيات، الحالات، وإعادة تعيين كلمات المرور.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">إجمالي المستخدمين</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">{allUsers.length}</div>
          </Card>
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">نشطون</div>
            <div className="mt-1 text-xl font-extrabold text-[#016564]">
              {allUsers.filter((u) => u.status === 'active').length}
            </div>
          </Card>
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">بانتظار المراجعة</div>
            <div className="mt-1 text-xl font-extrabold text-[#d0b284]">
              {allUsers.filter((u) => u.status === 'pending').length}
            </div>
          </Card>
          <Card className="rounded-2xl border border-[#d6d7d4] p-3 shadow-none">
            <div className="text-xs text-[#6f7b7a]">موقوفون / مؤرشفون</div>
            <div className="mt-1 text-xl font-extrabold text-[#7c1e3e]">
              {
                allUsers.filter((u) => u.status === 'disabled' || u.status === 'archived').length
              }
            </div>
          </Card>
        </div>
      </section>

      <section className="rounded-[28px] border border-[#d6d7d4] bg-white p-4 shadow-sm sm:p-5">
        <Input
          label="بحث"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو البريد أو الإدارة أو الرقم الوظيفي"
        />
      </section>

      <section className="space-y-3">
        {filteredUsers.length === 0 ? (
          <Card className="rounded-[28px] border border-[#d6d7d4] p-8 text-center text-sm text-[#61706f] shadow-sm">
            لا توجد نتائج مطابقة
          </Card>
        ) : (
          filteredUsers.map((user) => {
            const meta = statusMeta(user.status);
            return (
              <Card
                key={user.id}
                className="rounded-[28px] border border-[#d6d7d4] p-4 shadow-sm sm:p-5"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-base font-bold text-[#152625]">{user.fullName}</div>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      <Badge variant="neutral">{roleLabel(user.role)}</Badge>
                      {user.mustChangePassword ? (
                        <Badge variant="warning">يجب تغيير كلمة المرور</Badge>
                      ) : null}
                    </div>

                    <div className="grid gap-2 text-xs text-[#61706f] sm:grid-cols-2">
                      <div>البريد: {user.email || '—'}</div>
                      <div>الرقم الوظيفي: {user.employeeId || '—'}</div>
                      <div>الإدارة: {user.department || '—'}</div>
                      <div>المسمى: {user.jobTitle || '—'}</div>
                      <div>الجوال: {user.mobile || '—'}</div>
                      <div>التحويلة: {user.extension || '—'}</div>
                      <div>المشروع: {user.operationalProject || '—'}</div>
                      <div>آخر دخول: {formatDate(user.lastLoginAt)}</div>
                    </div>
                  </div>

                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    {user.status === 'pending' ? (
                      <>
                        <Button className="w-full sm:w-auto" onClick={() => approveUser(user.id)}>
                          اعتماد
                        </Button>
                        <Button
                          variant="danger"
                          className="w-full sm:w-auto"
                          onClick={() => rejectUser(user.id)}
                        >
                          رفض
                        </Button>
                      </>
                    ) : null}

                    {user.status === 'disabled' || user.status === 'archived' ? (
                      <Button className="w-full sm:w-auto" onClick={() => activateUser(user.id)}>
                        تفعيل
                      </Button>
                    ) : null}

                    {user.status === 'active' ? (
                      <>
                        <Button
                          variant="secondary"
                          className="w-full sm:w-auto"
                          onClick={() => disableUser(user.id)}
                        >
                          إيقاف
                        </Button>
                        <Button
                          variant="danger"
                          className="w-full sm:w-auto"
                          onClick={() => archiveUser(user.id)}
                        >
                          أرشفة
                        </Button>
                      </>
                    ) : null}

                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onClick={() => openEditor(user.id)}
                    >
                      إدارة المستخدم
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })
        )}
      </section>

      <Modal
        isOpen={!!selectedUser}
        onClose={closeEditor}
        title={selectedUser ? `إدارة المستخدم: ${selectedUser.fullName}` : 'إدارة المستخدم'}
      >
        {selectedUser ? (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2">
              <Input label="الاسم الكامل" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              <Input label="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="رقم الجوال" value={mobile} onChange={(e) => setMobile(e.target.value)} />
              <Input label="التحويلة" value={extension} onChange={(e) => setExtension(e.target.value)} />
              <Input label="الإدارة" value={department} onChange={(e) => setDepartment(e.target.value)} />
              <Input label="المسمى الوظيفي" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
              <Input
                label="المشروع التشغيلي"
                value={operationalProject}
                onChange={(e) => setOperationalProject(e.target.value)}
              />

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">الدور</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as EditableRole)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                >
                  <option value="manager">مدير</option>
                  <option value="warehouse">مسؤول مخزن</option>
                  <option value="user">موظف</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-slate-700">الحالة</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as EditableStatus)}
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10"
                >
                  <option value="active">نشط</option>
                  <option value="pending">بانتظار المراجعة</option>
                  <option value="disabled">موقوف</option>
                  <option value="rejected">مرفوض</option>
                  <option value="archived">مؤرشف</option>
                </select>
              </div>
            </section>

            <section className="rounded-2xl border border-[#e7ebea] bg-[#fcfdfd] p-4">
              <div className="mb-3 text-sm font-bold text-[#016564]">إدارة كلمة المرور</div>

              <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
                <Input
                  label="كلمة مرور جديدة"
                  value={customPassword}
                  onChange={(e) => setCustomPassword(e.target.value)}
                  placeholder="اتركها فارغة لتوليد كلمة مرور مؤقتة"
                />
                <div className="flex items-end">
                  <Button className="w-full" onClick={handleResetPassword}>
                    إعادة التعيين
                  </Button>
                </div>
              </div>

              {passwordResult ? (
                <div className="mt-4 rounded-2xl border border-[#d6d7d4] bg-white px-4 py-3 text-sm text-[#304342]">
                  <div className="font-semibold text-[#016564]">كلمة المرور المؤقتة الجديدة</div>
                  <div className="mt-2 font-mono text-base">{passwordResult}</div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="secondary"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const result = setUserMustChangePassword(selectedUser.id, true);
                    if (!result.ok) {
                      alert(result.message || 'تعذر تنفيذ العملية');
                      return;
                    }
                    alert('تم فرض تغيير كلمة المرور عند الدخول القادم');
                  }}
                >
                  فرض تغيير كلمة المرور
                </Button>

                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    const result = setUserMustChangePassword(selectedUser.id, false);
                    if (!result.ok) {
                      alert(result.message || 'تعذر تنفيذ العملية');
                      return;
                    }
                    alert('تم إلغاء فرض تغيير كلمة المرور');
                  }}
                >
                  إلغاء الفرض
                </Button>
              </div>
            </section>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={closeEditor}>
                إغلاق
              </Button>
              <Button className="w-full sm:w-auto" onClick={handleSave}>
                حفظ التعديلات
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}