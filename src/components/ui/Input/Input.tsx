import React, { useId } from 'react';
import { cn } from '@/lib/utils/cn';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, id, ...props }, ref) => {
    const reactId = useId();
    const generatedId = id || props.name || `input-${reactId}`;

    return (
      <div className="space-y-2">
        {label ? (
          <label
            htmlFor={generatedId}
            className="block text-sm font-semibold text-slate-700"
          >
            {label}
          </label>
        ) : null}

        <input
          id={generatedId}
          ref={ref}
          className={cn(
            'w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition',
            'placeholder:text-slate-400 focus:border-[#016564] focus:ring-4 focus:ring-[#016564]/10',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);

Input.displayName = 'Input';