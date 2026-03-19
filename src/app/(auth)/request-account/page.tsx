'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const projects = [
  'مشروع القيادة الأمنية',
  'مشروع التهديدات الحديثة',
  'مشروع الوقاية الأمنية',
  'لا ينطبق',
];

export default function RequestAccountPage() {
  const [submitted, setSubmitted] = useState(false);
  const [undertakingAccepted, setUndertakingAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
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

  const handleSubmit = async (e: React.FormEvent) => {
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

    setLoading(true);

    try {
      const response = await fetch('/api/auth/request-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName,
          email: form.email,
          mobile: form.mobile,
          extension: form.extension,
          operationalProject: form.operationalProject,
          password: form.password,
          undertakingAccepted,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error || 'تعذر إنشاء الحساب');
        return;
      }

      setSubmitted(true);
    } finally {
      setLoading(false);
    }
  };

  const inputClassName =
    'min-h-[48px] w-full min-w-0 rounded-[16px] border border-[#d7dde2] bg-white px-4 text-right text-[14px] text-[#1f2a44] outline-none transition placeholder:text-[#9aa3b2] focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10';

  const labelClassName =
    'mb-2 block text-right text-[13px] font-semibold text-[#2a3550]';

  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-x-hidden bg-[#edf3f2]"
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
                إنشاء حساب جديد
                <br />
                والدخول مباشرة إلى المنصة
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex min-h-screen items-center justify-center px-4 py-5 sm:px-5 sm:py-8 lg:px-6 xl:px-8">
          <div className="absolute inset-0 opacity-60">
            <div className="absolute right-6 top-6 h-24 w-24 rounded-full bg-[#016564]/6 blur-3xl sm:h-32 sm:w-32" />
            <div className="absolute bottom-8 left-6 h-20 w-20 rounded-full bg-[#d0b284]/14 blur-3xl sm:h-28 sm:w-28" />
          </div>

          <div className="relative z-10 w-full max-w-[520px]">
            <div className="mb-4 lg:hidden">
              <div className="rounded-[26px] border border-white/15 bg-[linear-gradient(135deg,#015857_0%,#016564_50%,#0b7f7c_100%)] p-4 sm:rounded-[30px] sm:p-5">
                <div className="flex items-center justify-center rounded-[22px] border border-white/10 bg-white/5 px-4 py-5 sm:rounded-[24px] sm:px-5 sm:py-6">
                  <img
                    src="/nauss-gold-logo.png"
                    alt="شعار جامعة نايف"
                    className="max-h-[72px] w-auto object-contain sm:max-h-[82px]"
                  />
                </div>

                <div className="mt-4 rounded-[20px] border border-white/10 bg-white/10 px-4 py-4 text-center text-white sm:rounded-[22px]">
                  <p className="text-lg font-normal leading-[1.8] sm:text-2xl sm:leading-[1.7]">
                    إنشاء حساب جديد
                    <br />
                    والدخول مباشرة إلى المنصة
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/80 bg-white/95 p-4 shadow-[0_12px_32px_rgba(15,23,42,0.07)] backdrop-blur-xl sm:rounded-[30px] sm:p-6">
              <div className="mb-5 text-center">
                <h1 className="text-[26px] font-normal text-[#0f1d3b] sm:text-[34px]">
                  إنشاء حساب
                </h1>
              </div>

              {submitted ? (
                <div className="space-y-3 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
                  <div className="text-[14px] leading-7 text-emerald-700">
                    تم إنشاء الحساب بنجاح. يمكنك الآن تسجيل الدخول واستخدام المنصة مباشرة.
                  </div>
                  <Link
                    href="/login"
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[14px] bg-[#016564] px-4 py-2 text-[14px] text-white"
                  >
                    الانتقال إلى تسجيل الدخول
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

                  <label className="flex items-start gap-3 rounded-[16px] border border-[#d8dee1] bg-[#fbfcfc] px-4 py-4 text-[13px] leading-7 text-[#2f3851]">
                    <input
                      type="checkbox"
                      checked={undertakingAccepted}
                      onChange={(e) => setUndertakingAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 shrink-0 rounded border border-[#aab3ba] text-[#016564] focus:ring-[#016564]"
                    />
                    <span className="min-w-0">
                      أتعهد بالمحافظة على سرية بيانات الدخول وصحة البيانات المدخلة،
                      وأتحمل مسؤولية استخدام الحساب وفق الأنظمة والإجراءات المعتمدة.
                    </span>
                  </label>

                  {error ? (
                    <div className="rounded-[14px] border border-red-200 bg-red-50 px-4 py-3 text-[13px] leading-6 text-red-700">
                      {error}
                    </div>
                  ) : null}

                  <button
                    type="submit"
                    disabled={
                      loading ||
                      !undertakingAccepted ||
                      !form.password ||
                      form.password !== form.confirmPassword
                    }
                    className="flex min-h-[50px] w-full items-center justify-center rounded-[16px] bg-[#0b8a88] px-4 text-[15px] text-white shadow-[0_10px_22px_rgba(11,138,136,0.16)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {loading ? 'جارٍ إنشاء الحساب...' : 'إنشاء الحساب'}
                  </button>
                </form>
              )}

              <div className="mt-5 text-center text-[14px] leading-7 text-[#5f687b]">
                لديك حساب بالفعل؟
                <Link href="/login" className="mr-2 text-[#016564]">
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