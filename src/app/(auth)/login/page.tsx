'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [keepConnected, setKeepConnected] = useState(true);
  const [form, setForm] = useState({
    email: '',
    password: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(form.email, form.password);
    } catch (err: any) {
      setError(err.message || 'تعذر تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen overflow-hidden bg-[#edf3f2]"
      style={{
        background:
          'radial-gradient(circle at top right, rgba(1,101,100,0.08), transparent 22%), radial-gradient(circle at bottom left, rgba(208,178,132,0.10), transparent 22%), linear-gradient(180deg, #f6f8f8 0%, #edf3f2 100%)',
      }}
    >
      <div className="grid min-h-screen lg:grid-cols-[0.95fr_1.05fr]">
        <section className="relative hidden min-h-screen overflow-hidden lg:flex lg:items-center lg:justify-center">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#015f5f_0%,#016564_42%,#014948_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(208,178,132,0.20),transparent_24%),radial-gradient(circle_at_bottom_left,rgba(255,255,255,0.07),transparent_18%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:34px_34px]" />

          <div className="absolute -right-24 top-0 h-full w-[240px] bg-white/8 [clip-path:polygon(35%_0,100%_0,68%_100%,0_100%)]" />
          <div className="absolute -left-24 top-0 h-full w-[220px] bg-black/8 [clip-path:polygon(28%_0,100%_0,72%_100%,0_100%)]" />

          <div className="absolute right-[10%] top-[16%] h-28 w-28 rounded-[30px] border border-white/10 bg-white/8 blur-[2px]" />
          <div className="absolute bottom-[14%] right-[18%] h-20 w-20 rounded-full border border-white/10 bg-white/8" />
          <div className="absolute left-[12%] top-[24%] h-16 w-16 rounded-2xl border border-white/10 bg-[#d0b284]/10" />

          <div className="relative z-10 flex w-full max-w-[760px] flex-col items-center justify-center px-10 text-center text-white">
            <div className="relative">
              <div className="relative flex min-h-[240px] w-[520px] items-center justify-center rounded-[40px] border border-white/10 bg-white/8 px-10 backdrop-blur-md">
                <img
                  src="/nauss-gold-logo.png"
                  alt="شعار جامعة نايف"
                  className="max-h-[170px] w-auto object-contain"
                />
              </div>
            </div>

            <div className="mt-10 rounded-[28px] border border-white/10 bg-white/10 px-8 py-6 backdrop-blur-md">
              <p className="text-[34px] font-normal leading-[1.6]">
                منصة مواد التدريب 
                <br />
                وكالة التدريب
              </p>
            </div>
          </div>
        </section>

        <section className="relative flex items-center justify-center px-5 py-8 lg:px-8 xl:px-12">
          <div className="absolute inset-0 opacity-50">
            <div className="absolute right-10 top-10 h-40 w-40 rounded-full bg-[#016564]/6 blur-3xl" />
            <div className="absolute bottom-10 left-10 h-32 w-32 rounded-full bg-[#d0b284]/16 blur-3xl" />
          </div>

          <div className="relative z-10 w-full max-w-[480px]">
            <div className="mb-6 lg:hidden">
              <div className="rounded-[30px] border border-white/15 bg-[linear-gradient(135deg,#015857_0%,#016564_50%,#0b7f7c_100%)] p-5">
                <div className="flex items-center justify-center rounded-[24px] border border-white/10 bg-white/5 px-5 py-6">
                  <img
                    src="/nauss-gold-logo.png"
                    alt="شعار جامعة نايف"
                    className="max-h-[82px] w-auto object-contain"
                  />
                </div>

                <div className="mt-4 rounded-[22px] border border-white/10 bg-white/10 px-4 py-4 text-center text-white">
                  <p className="text-2xl font-normal leading-[1.7]">
                    منصة حوكمة وإدارة
                    <br />
                    مخزون وكالة التدريب
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-soft sm:p-8">
              <div className="mb-7 text-center">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#016564]/10 text-[#016564]">
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-7 w-7"
                    aria-hidden="true"
                  >
                    <path
                      d="M12 3L19 6V11C19 15.5 16.2 19.74 12 21C7.8 19.74 5 15.5 5 11V6L12 3Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M9.5 12.2L11.2 13.9L14.8 10.3"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </div>

                <h1 className="text-3xl font-normal text-[#0f1d3b] sm:text-4xl">
                  تسجيل الدخول
                </h1>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="mb-2 block text-right text-[14px] font-normal text-[#1d2640]">
                    البريد الإلكتروني
                  </label>
                  <div className="group flex h-[56px] items-center gap-3 rounded-[18px] border border-[#d8dee1] bg-white px-4 transition focus-within:border-[#016564]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-[18px] w-[18px] shrink-0 text-[#6b7280] transition group-focus-within:text-[#016564]"
                      aria-hidden="true"
                    >
                      <path
                        d="M4 7.5C4 6.67 4.67 6 5.5 6H18.5C19.33 6 20 6.67 20 7.5V16.5C20 17.33 19.33 18 18.5 18H5.5C4.67 18 4 17.33 4 16.5V7.5Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M5 8L12 13L19 8"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="أدخل البريد الإلكتروني"
                      className="h-full w-full border-none bg-transparent px-0 text-right text-[15px] font-normal text-[#1d2640] outline-none placeholder:text-[#9aa3b2]"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-right text-[14px] font-normal text-[#1d2640]">
                    كلمة المرور
                  </label>
                  <div className="group flex h-[56px] items-center gap-3 rounded-[18px] border border-[#d8dee1] bg-white px-4 transition focus-within:border-[#016564]">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-[18px] w-[18px] shrink-0 text-[#6b7280] transition group-focus-within:text-[#016564]"
                      aria-hidden="true"
                    >
                      <path
                        d="M7 11V8.8C7 6.15 9.15 4 11.8 4C14.45 4 16.6 6.15 16.6 8.8V11"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                      <path
                        d="M6 11H18C18.55 11 19 11.45 19 12V18C19 18.55 18.55 19 18 19H6C5.45 19 5 18.55 5 18V12C5 11.45 5.45 11 6 11Z"
                        stroke="currentColor"
                        strokeWidth="1.7"
                      />
                      <path
                        d="M12 14V16"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                      />
                    </svg>
                    <input
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="أدخل كلمة المرور"
                      className="h-full w-full border-none bg-transparent px-0 text-right text-[15px] font-normal text-[#1d2640] outline-none placeholder:text-[#9aa3b2]"
                      required
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 pt-1">
                  <label className="flex items-center gap-3 text-[14px] font-normal text-[#2f3851]">
                    <input
                      type="checkbox"
                      checked={keepConnected}
                      onChange={(e) => setKeepConnected(e.target.checked)}
                      className="h-4 w-4 rounded border border-[#aab3ba] text-[#016564] focus:ring-0"
                    />
                    أبقني متصلًا
                  </label>

                  <Link
                    href="#"
                    className="text-[14px] font-normal text-[#016564] transition hover:opacity-80"
                  >
                    نسيت كلمة المرور؟
                  </Link>
                </div>

                {error ? (
                  <div className="rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-sm font-normal text-red-700">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={loading}
                  className="flex h-[58px] w-full items-center justify-center gap-2 rounded-[18px] bg-[linear-gradient(135deg,#016564_0%,#0d8b88_100%)] text-[20px] font-normal text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <span>{loading ? 'جاري الدخول...' : 'تسجيل الدخول'}</span>
                  {!loading && (
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="h-[18px] w-[18px]"
                      aria-hidden="true"
                    >
                      <path
                        d="M10 7L15 12L10 17"
                        stroke="currentColor"
                        strokeWidth="1.9"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </button>
              </form>

              <div className="mt-6 rounded-[20px] border border-[#eef1f4] bg-[#f9fbfb] px-4 py-4 text-center text-[16px] font-normal text-[#5f687b]">
                ليس لديك حساب؟
                <Link
                  href="/request-account"
                  className="mr-2 font-normal text-[#016564]"
                >
                  سجل جديد
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
