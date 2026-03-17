import React from 'react';
import { cn } from '@/lib/utils/cn';
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-xl bg-gray-200', className)} />;
}
