'use client';

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/Button';

type ModalSize = 'md' | 'lg' | 'xl' | '2xl' | 'full';

const SIZE_MAP: Record<ModalSize, string> = {
  md: 'max-w-2xl',
  lg: 'max-w-4xl',
  xl: 'max-w-5xl',
  '2xl': 'max-w-6xl',
  full: 'max-w-[min(96vw,1600px)]',
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
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = originalOverflow || '';
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[80] overflow-y-auto bg-[#0b1716]/60 p-2 backdrop-blur-[2px] sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title || 'نافذة منبثقة'}
    >
      <div className="flex min-h-full items-start justify-center py-2 sm:items-center sm:py-6">
        <button
          type="button"
          aria-label="إغلاق النافذة"
          className="absolute inset-0 cursor-default"
          onClick={onClose}
        />

        <div
          className={`relative z-[81] w-full ${SIZE_MAP[size]} overflow-hidden rounded-[22px] border border-[#d6d7d4] bg-white shadow-2xl sm:rounded-[28px]`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-3 border-b border-[#e7ebea] px-4 py-4 sm:px-6">
            <h3 className="min-w-0 flex-1 text-sm font-extrabold leading-7 text-[#016564] sm:text-lg">
              {title}
            </h3>

            <Button variant="ghost" size="sm" onClick={onClose} className="shrink-0">
              إغلاق
            </Button>
          </div>

          <div
            className={`max-h-[calc(100dvh-5.5rem)] overflow-y-auto overflow-x-hidden p-4 sm:max-h-[88vh] sm:p-6 ${bodyClassName}`}
          >
            <div className="min-w-0">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
