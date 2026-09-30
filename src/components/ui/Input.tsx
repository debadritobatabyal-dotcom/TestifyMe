import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, helperText, leftIcon, rightIcon, className = '', id, ...props }, ref) => {
    const inputId = id || `input-${Math.random().toString(36).substring(2, 8)}`;

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="block text-xs sm:text-sm font-heading font-bold text-[#332F3A]">
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 flex items-center pointer-events-none text-[#635F69]/70">
              {leftIcon}
            </div>
          )}
          <input
            id={inputId}
            ref={ref}
            className={`w-full bg-white text-[#332F3A] rounded-[16px] border ${
              error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-200' : 'border-[#635F69]/20 focus:border-[#7C3AED] focus:ring-purple-100'
            } px-4 py-2.5 text-sm min-h-[44px] transition-all duration-150 focus:outline-none focus:ring-4 shadow-[inset_0_2px_4px_rgba(51,47,58,0.02)] placeholder:text-[#635F69]/50 ${
              leftIcon ? 'pl-11' : ''
            } ${rightIcon ? 'pr-11' : ''} ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3.5 flex items-center text-[#635F69]/70">
              {rightIcon}
            </div>
          )}
        </div>
        {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
        {helperText && !error && <p className="text-xs text-[#635F69]">{helperText}</p>}
      </div>
    );
  }
);

Input.displayName = 'Input';
