import Link from 'next/link';
import { Button } from '@/components/ui/Button';
export default function NotFound() {
  return <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface px-6 text-center"><h1 className="text-3xl font-bold text-primary">404</h1><p className="text-surface-subtle">الصفحة غير موجودة</p><Link href="/dashboard"><Button>العودة إلى المنصة</Button></Link></div>;
}
