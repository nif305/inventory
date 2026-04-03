import React, { useId } from 'react';
import { cn } from '@/lib/utils/cn';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, hint, error, id, rows = 5, ...props }, ref) => {
    const reactId = useId();
    const generatedId = id || props.name || `textarea-${reactId}`;
    const describedBy = [
      hint ? `${generatedId}-hint` : null,
      error ? `${generatedId}-error` : null,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className="w-full min-w-0 space-y-2">
        {label ? (
          <label
            htmlFor={generatedId}
            className="block text-sm font-semibold leading-6 text-slate-700"
          >
            {label}
          </label>
        ) : null}

        <textarea
          id={generatedId}
          ref={ref}
          rows={rows}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          className={cn(
            'block min-h-[120px] w-full min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition',
            'placeholder:text-slate-400 focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10',
            'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400',
            'resize-y sm:text-sm',
            className
          )}
          {...props}
        />

        {hint ? (
          <p id={`${generatedId}-hint`} className="text-xs leading-5 text-slate-500">
            {hint}
          </p>
        ) : null}

        {error ? (
          <p id={`${generatedId}-error`} className="text-xs leading-5 text-red-600">
            {error}
          </p>
        ) : null}
      </div>
    );
  }
);

Textarea.displayName = 'Textarea';
