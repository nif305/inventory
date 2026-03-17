'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { User } from '@/features/auth/types/auth.types';

const USERS_STORAGE_KEY = 'inventory_users';

const projects = [
  'مشروع القيادة الأمنية',
  'مشروع التهديدات الحديثة',
  'مشروع الوقاية الأمنية',
  'لا ينطبق',
];

function loadUsers(): User[] {
  if (typeof window === 'undefined') return [];

  const stored = localStorage.getItem(USERS_STORAGE_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored) as User[];
  } catch {
    return [];
  }
}

function saveUsers(users: User[]) {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
}

function buildEmployeeId(users: User[]) {
  const numericIds = users
    .map((u) => Number(u.employeeId))
    .filter((n) => Number.isFinite(n));

  const nextId = numericIds.length ? Math.max(...numericIds) + 1 : 1005;
  return String(nextId);
}

export default function RequestAccountPage() {
  const [submitted, setSubmitted] = useState(false);
  const [undertakingAccepted, setUndertakingAccepted] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    mobile: '',
    extension: '',
    operationalProject: '',
    password: '',
    confirmPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!undertakingAccepted) {
      setError('يجب قبول التعهد قبل إرسال الطلب.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('كلمة المرور وتأكيدها غير متطابقين.');
      return;
    }

    const users = loadUsers();
    const normalizedEmail = form.email.trim().toLowerCase();

    const existingUser = users.find(
      (u) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      setError('يوجد حساب أو طلب سابق بهذا البريد الإلكتروني.');
      return;
    }

    const newUser: User = {
      id: `usr_${Date.now()}`,
      employeeId: buildEmployeeId(users),
      fullName: form.fullName.trim(),
      email: normalizedEmail,
      mobile: form.mobile.trim(),
      extension: form.extension.trim(),
      department:
        form.operationalProject && form.operationalProject !== 'لا ينطبق'
          ? form.operationalProject
          : 'وكالة التدريب',
      jobTitle: 'موظف',
      operationalProject: form.operationalProject,
      role: 'user',
      status: 'pending',
      avatar: null,
      undertaking: {
        accepted: true,
        acceptedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      lastLoginAt: null,
    };

    saveUsers([newUser, ...users]);
    setSubmitted(true);
  };

  const inputClassName =
    'h-[40px] w-full rounded-[12px] border border-[#d7dde2] bg-white px-3 text-right text-[13px] font-normal text-[#1f2a44] outline-none transition focus:border-[#016564] focus:ring-2 focus:ring-[#016564]/10';

  const labelClassName =
    'mb-1.5 block text-right text-[12px] font-normal text-[#2a3550]';

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-[#edf3f2]"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(1,101,100,0.06), transparent 20%), radial-gradient(circle at bottom left, rgba(208,178,132,0.06), transparent 18%), linear-gradient(180deg, #f7f9f9 0%, #edf3f2 100%)',
      }}
    >
      <div className="grid min-h-screen lg:grid-cols-[0.88fr_1.12fr]">
        <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#015f5f_0%,#016564_42%,#014948_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(208,178,132,0.16),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.06),transparent_18%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:34px_34px]" />

          <div className="relative z-10 flex w-full max-w-[560px] flex-col items-center px-8 text-center text-white">
            <div className="relative mb-6">
              <div className="absolute inset-0 scale-110 rounded-[28px] bg-[#d0b284]/10 blur-3xl" />
              <div className="relative flex min-h-[150px] w-[340px] items-center justify-center rounded-[24px] border border-white/10 bg-white/8 px-6 shadow-[0_18px_40px_rgba(0,0,0,0.16)] backdrop-blur-xl">
                <img
                  src="/nauss-gold-logo.png"
                  alt="شعار جامعة نايف"
                  className="max-h-[175px] w-auto object-contain"
                />
              </div>
            </div>

            <div className="rounded-[20px] border border-white/10 bg-white/10 px-5 py-3 shadow-[0_12px_28px_rgba(0,0,0,0.12)] backdrop-blur-xl">
              <p className="text-[18px] font-normal leading-[1.7]">
                طلب إنشاء حساب جديد
                <br />
                لمنصة إدارة المخزون
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-4 py-6 lg:px-6 xl:px-8">
          <div className="relative z-10 w-full max-w-[420px]">
            <div className="rounded-[20px] border border-white/80 bg-white/95 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:p-5">
              <div className="mb-4 text-center lg:hidden">
                <div className="mb-3 flex justify-center">
                  <div className="flex min-h-[82px] w-full items-center justify-center rounded-[18px] border border-[#d0b284]/20 bg-[#016564] px-4 shadow-[0_12px_28px_rgba(1,101,100,0.14)]">
                    <img
                      src="/nauss-gold-logo.png"
                      alt="شعار جامعة نايف"
                      className="max-h-[52px] w-auto object-contain"
                    />
                  </div>
                </div>
              </div>

              <div className="mb-4 text-center">
                <h1 className="text-[32px] font-normal text-[#0f1d3b]">
                  طلب إنشاء حساب
                </h1>
              </div>

              {submitted ? (
                <div className="space-y-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                  <div className="text-[13px] font-normal text-emerald-700">
                    تم إرسال الطلب بنجاح، وسيظهر للمدير بحالة قيد المراجعة.
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex rounded-[10px] bg-[#016564] px-3 py-1.5 text-[13px] font-normal text-white"
                  >
                    العودة لتسجيل الدخول
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div>
                    <label className={labelClassName}>الاسم كامل</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                      className={inputClassName}
                      required
                    />
                  </div>

                  <div>
                    <label className={labelClassName}>البريد الإلكتروني</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      className={inputClassName}
                      required
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClassName}>رقم الجوال</label>
                      <input
                        type="text"
                        value={form.mobile}
                        onChange={(e) => setForm({ ...form, mobile: e.target.value })}
                        className={inputClassName}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClassName}>التحويلة</label>
                      <input
                        type="text"
                        value={form.extension}
                        onChange={(e) => setForm({ ...form, extension: e.target.value })}
                        className={inputClassName}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelClassName}>المشروع التشغيلي</label>
                    <select
                      value={form.operationalProject}
                      onChange={(e) => setForm({ ...form, operationalProject: e.target.value })}
                      className={inputClassName}
                      required
                    >
                      <option value="">اختر المشروع التشغيلي</option>
                      {projects.map((project) => (
                        <option key={project} value={project}>
                          {project}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelClassName}>كلمة المرور</label>
                      <input
                        type="password"
                        value={form.password}
                        onChange={(e) => setForm({ ...form, password: e.target.value })}
                        className={inputClassName}
                        required
                      />
                    </div>

                    <div>
                      <label className={labelClassName}>تأكيد كلمة المرور</label>
                      <input
                        type="password"
                        value={form.confirmPassword}
                        onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                        className={inputClassName}
                        required
                      />
                    </div>
                  </div>

                  <label className="flex items-start gap-2.5 rounded-[14px] border border-[#d8dee1] bg-[#fbfcfc] px-3 py-3 text-[12px] font-normal leading-6 text-[#2f3851]">
                    <input
                      type="checkbox"
                      checked={undertakingAccepted}
                      onChange={(e) => setUndertakingAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border border-[#aab3ba] text-[#016564] focus:ring-[#016564]"
                    />
                    <span>
                      أتعهد بالمحافظة على سرية بيانات الدخول وصحة البيانات المدخلة،
                      وأتحمل مسؤولية استخدام الحساب وفق الأنظمة والإجراءات المعتمدة.
                    </span>
                  </label>

                  {error ? (
                    <div className="rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-normal text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      !undertakingAccepted ||
                      !form.password ||
                      form.password !== form.confirmPassword
                    }
                    className="h-[42px] w-full rounded-[14px] bg-[#0b8a88] text-[14px] font-normal text-white shadow-[0_10px_22px_rgba(11,138,136,0.16)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    إرسال الطلب
                  </button>
                </form>
              )}

              <div className="mt-4 text-center text-[13px] font-normal text-[#5f687b]">
                لديك حساب بالفعل؟
                <Link href="/login" className="mr-2 font-normal text-[#016564]">
                  تسجيل الدخول
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}