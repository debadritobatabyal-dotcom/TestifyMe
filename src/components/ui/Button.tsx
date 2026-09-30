import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  isLoading = false,
  icon,
  className = '',
  disabled,
  ...props
}) => {
  const baseClasses =
    'inline-flex items-center justify-center font-heading font-bold transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none min-h-[44px] cursor-pointer';

  const sizeClasses = {
    sm: 'text-xs px-3.5 py-1.5 rounded-[14px] min-h-[38px]',
    md: 'text-sm px-5 py-2.5 rounded-[18px] min-h-[44px]',
    lg: 'text-base px-6 py-3.5 rounded-[20px] min-h-[50px]',
  }[size];

  const variantClasses = {
    primary:
      'bg-gradient-to-r from-[#8B5CF6] to-[#7C3AED] text-white shadow-[0_6px_18px_-3px_rgba(124,58,237,0.35)] hover:shadow-[0_10px_22px_-3px_rgba(124,58,237,0.45)] border border-white/20 active:translate-y-0.5',
    secondary:
      'bg-white text-[#332F3A] border border-[#635F69]/20 shadow-[0_4px_12px_-2px_rgba(51,47,58,0.06)] hover:bg-[#FAF8FD] hover:text-[#7C3AED] hover:border-[#7C3AED]/30 active:translate-y-0.5',
    danger:
      'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-[0_6px_16px_-3px_rgba(239,68,68,0.35)] hover:shadow-[0_8px_20px_-3px_rgba(239,68,68,0.45)] border border-white/20 active:translate-y-0.5',
    success:
      'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-[0_6px_16px_-3px_rgba(16,185,129,0.35)] hover:shadow-[0_8px_20px_-3px_rgba(16,185,129,0.45)] border border-white/20 active:translate-y-0.5',
    ghost:
      'bg-transparent text-[#635F69] hover:bg-purple-100/50 hover:text-[#7C3AED] min-h-[40px]',
  }[variant];

  const widthClass = fullWidth ? 'w-full' : '';

  return (
    <button
      className={`${baseClasses} ${sizeClasses} ${variantClasses} ${widthClass} ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <span className="flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          <span>Loading...</span>
        </span>
      ) : (
        <span className="flex items-center gap-2">
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{children}</span>
        </span>
      )}
    </button>
  );
};
