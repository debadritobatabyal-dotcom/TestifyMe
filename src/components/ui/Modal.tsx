import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'md',
}) => {
  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lock body scroll when open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#332F3A]/40 backdrop-blur-xs transition-opacity duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Dialog content (Adapts as rounded top sheet on mobile, centered modal on desktop) */}
      <div
        role="dialog"
        aria-modal="true"
        className={`relative w-full ${maxWidthClasses} bg-white rounded-t-[28px] sm:rounded-[28px] border border-purple-500/15 shadow-[0_20px_50px_-12px_rgba(51,47,58,0.25)] p-5 sm:p-7 max-h-[92vh] sm:max-h-[88vh] overflow-y-auto transform transition-all duration-200 z-10`}
      >
        {/* Mobile handle indicator */}
        <div className="sm:hidden flex justify-center mb-3">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>

        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            {title && <h3 className="text-lg sm:text-xl font-heading font-extrabold text-[#332F3A]">{title}</h3>}
            {description && <p className="text-xs sm:text-sm text-[#635F69] mt-0.5">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-full text-[#635F69] hover:bg-gray-100 hover:text-[#332F3A] transition-colors shrink-0 min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div>{children}</div>
      </div>
    </div>
  );
};
