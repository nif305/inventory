'use client';

import React from 'react';
import { Button } from '@/components/ui/Button';

type ModalSize = 'md' | 'lg' | 'xl' | '2xl' | 'full';

const SIZE_MAP: Record<ModalSize, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[92vw]',
};

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  bodyClassName = '',
}: {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: ModalSize;
  bodyClassName?: string;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0b1716]/50 p-3 sm:p-4">
      <div
        className={`w-full ${SIZE_MAP[size]} overflow-hidden rounded-[28px] border border-[#d6d7d4] bg-white shadow-2xl`}
      >
        <div className="flex items-center justify-between border-b border-[#e7ebea] px-5 py-4 sm:px-6">
          <h3 className="text-base font-extrabold text-[#016564] sm:text-lg">{title}</h3>
          <Button variant="ghost" size="sm" onClick={onClose}>
            إغلاق
          </Button>
        </div>

        <div className={`max-h-[86vh] overflow-y-auto p-4 sm:p-6 ${bodyClassName}`}>
          {children}
        </div>
      </div>
    </div>
  );
}