import React from 'react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionText?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionText,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-[24px] sm:rounded-[28px] border border-purple-500/10 p-8 sm:p-12 text-center max-w-lg mx-auto shadow-[0_8px_24px_-8px_rgba(124,58,237,0.06)] ${className}`}
    >
      {icon && (
        <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-purple-100 flex items-center justify-center text-[#7C3AED]">
          {icon}
        </div>
      )}
      <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#332F3A] mb-1.5">{title}</h3>
      <p className="text-xs sm:text-sm text-[#635F69] max-w-sm mx-auto mb-6">{description}</p>
      {actionText && onAction && (
        <Button variant="primary" size="md" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};
