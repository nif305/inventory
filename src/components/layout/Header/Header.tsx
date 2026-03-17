'use client';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/Button';
export function Header() {
  const { user, logout } = useAuth();
  return (
    <header className="flex items-center justify-between rounded-2xl border border-surface-border bg-white px-5 py-4 shadow-sm">
      <div><h1 className="font-bold text-primary">مرحباً، {user?.fullName}</h1><p className="text-xs text-surface-subtle">{user?.department}</p></div>
      <Button variant="ghost" onClick={logout}>تسجيل الخروج</Button>
    </header>
  );
}
