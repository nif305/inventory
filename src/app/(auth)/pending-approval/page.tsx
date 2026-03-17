'use client';

import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function PendingApprovalPage() {
  const { logout } = useAuth();
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <Card className="w-full max-w-xl rounded-[28px] p-8 text-center shadow-soft">
        <h1 className="text-[30px] leading-[1.25] text-primary">
          طلبك قيد المراجعة
        </h1>

        <p className="mt-4 text-[15px] leading-8 text-surface-subtle">
          تم استلام طلب إنشاء الحساب بنجاح، وسيتم إشعارك بعد اعتماده من الإدارة المختصة.
        </p>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Button
            onClick={logout}
            className="min-w-[160px]"
          >
            تسجيل الخروج
          </Button>

          <Button
            variant="ghost"
            onClick={() => router.push('/login')}
            className="min-w-[160px]"
          >
            العودة لتسجيل الدخول
          </Button>
        </div>
      </Card>
    </div>
  );
}
