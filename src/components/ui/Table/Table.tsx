import React from 'react';
import { cn } from '@/lib/utils/cn';
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="overflow-x-auto"><table className={cn('w-full text-right', className)} {...props} /></div>;
}
