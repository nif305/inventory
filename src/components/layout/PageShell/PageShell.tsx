import React from 'react';
import { cn } from '@/lib/utils/cn';
export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('space-y-6', className)}>{children}</div>;
}
