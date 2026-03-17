import React from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const styles: Record<Variant, string> = {
  neutral: 'bg-gray-100 text-gray-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-blue-100 text-blue-700',
};

export function Badge({
  children,
  variant = 'neutral',
  className,
}: {
  children: React.ReactNode;
  variant?: Variant;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-2.5 py-1 text-xs font-normal',
        styles[variant],
        className
      )}
    >
      {children}
    </span>
  );
}