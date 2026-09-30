import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'info' | 'neutral' | 'danger';
  size?: 'sm' | 'md';
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  size = 'md',
  className = '',
}) => {
  const sizeClasses = {
    sm: 'text-[11px] px-2.5 py-0.5 font-bold rounded-full',
    md: 'text-xs px-3 py-1 font-bold rounded-full',
  }[size];

  const variantClasses = {
    primary: 'bg-purple-100 text-[#7C3AED] border border-purple-200',
    secondary: 'bg-pink-100 text-[#DB2777] border border-pink-200',
    success: 'bg-emerald-100 text-[#10B981] border border-emerald-200',
    warning: 'bg-amber-100 text-[#D97706] border border-amber-200',
    info: 'bg-sky-100 text-[#0EA5E9] border border-sky-200',
    danger: 'bg-rose-100 text-rose-700 border border-rose-200',
    neutral: 'bg-gray-100 text-[#635F69] border border-gray-200',
  }[variant];

  return (
    <span className={`inline-flex items-center gap-1 font-heading tracking-tight ${sizeClasses} ${variantClasses} ${className}`}>
      {children}
    </span>
  );
};
