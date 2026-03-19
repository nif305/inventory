'use client';

import { Button } from '@/components/ui/Button';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const router = useRouter();

  return (
    <div
      dir="rtl"
      className="flex min-h-screen items-center justify-center overflow-x-hidden bg-surface px-4 py-6 sm:px-5 sm:py-8"
    >
      <div className="w-full max-w-xl rounded-[24px] border border-surface-border bg-white p-5 text-center shadow-soft sm:rounded-[28px] sm:p-8">
        <h1 className="text-[24px] leading-[1.3] text-primary sm:text-[30px]">
          لم تعد هناك مرحلة اعتماد
        </h1>

        <p className="mt-4 text-[14px] leading-7 text-surface-subtle sm:text-[15px] sm:leading-8">
          الحسابات الجديدة أصبحت تعمل مباشرة بعد التسجيل. يمكنك الآن الانتقال إلى صفحة تسجيل الدخول واستخدام الحساب فورًا.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:justify-center">
          <Button
            onClick={() => router.push('/login')}
            className="w-full sm:min-w-[180px] sm:w-auto"
          >
            الانتقال إلى تسجيل الدخول
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.push('/request-account')}
            className="w-full sm:min-w-[180px] sm:w-auto"
          >
            إنشاء حساب جديد
          </Button>
        </div>
      </div>
    </div>
  );
}