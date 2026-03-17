import React from 'react';
import { cn } from '@/lib/utils/cn';

export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('bg-white rounded-2xl border border-surface-border shadow-sm', className)} {...props} />
  )
);
Card.displayName = 'Card';
