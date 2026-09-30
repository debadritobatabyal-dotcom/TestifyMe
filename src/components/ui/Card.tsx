import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'elevated' | 'flat' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  padding = 'md',
  className = '',
  ...props
}) => {
  const paddingClasses = {
    none: 'p-0',
    sm: 'p-3.5 sm:p-4',
    md: 'p-4 sm:p-6',
    lg: 'p-6 sm:p-8',
  }[padding];

  const variantClasses = {
    elevated:
      'bg-white rounded-[24px] sm:rounded-[28px] border border-purple-500/10 shadow-[0_10px_28px_-8px_rgba(124,58,237,0.08),0_4px_12px_-2px_rgba(51,47,58,0.04)]',
    flat:
      'bg-white rounded-[20px] sm:rounded-[24px] border border-[#635F69]/15 shadow-[0_4px_12px_-2px_rgba(51,47,58,0.05)]',
    interactive:
      'bg-white rounded-[24px] border border-purple-500/15 shadow-[0_8px_24px_-8px_rgba(124,58,237,0.08)] hover:border-[#7C3AED]/40 hover:shadow-[0_12px_28px_-6px_rgba(124,58,237,0.14)] hover:-translate-y-0.5 transition-all duration-200 cursor-pointer',
  }[variant];

  return (
    <div className={`${variantClasses} ${paddingClasses} ${className}`} {...props}>
      {children}
    </div>
  );
};
