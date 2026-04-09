import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  suffix?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ label, error, hint, suffix, className = '', id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <div className="relative flex">
          <input
            id={inputId}
            ref={ref}
            className={`
              w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
              focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
              disabled:bg-gray-50 disabled:text-gray-500
              ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-500' : ''}
              ${suffix ? 'pr-12' : ''}
              ${className}
            `}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
              {suffix}
            </span>
          )}
        </div>
        {error && <p className="text-xs text-red-600">{error}</p>}
        {hint && !error && <p className="text-xs text-gray-500">{hint}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ label, error, className = '', id, ...props }, ref) {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1">
        {label && (
          <label htmlFor={inputId} className="text-sm font-medium text-gray-700">
            {label}
          </label>
        )}
        <textarea
          id={inputId}
          ref={ref}
          rows={3}
          className={`
            w-full rounded-lg border border-gray-300 px-3 py-2 text-sm
            focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500
            resize-y
            ${error ? 'border-red-400' : ''}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-xs text-red-600">{error}</p>}
      </div>
    );
  }
);
Textarea.displayName = 'Textarea';
