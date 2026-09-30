import React from 'react';
import { Timer } from './Timer';
import { Button } from '../ui/Button';
import { Check, LayoutGrid } from 'lucide-react';

export interface ExamHeaderProps {
  testName: string;
  expiresAt: number;
  totalQuestions: number;
  answeredCount: number;
  isSaving: boolean;
  onTimeExpired: () => void;
  onSubmitClick: () => void;
  onOpenNavigator: () => void;
}

export const ExamHeader: React.FC<ExamHeaderProps> = ({
  testName,
  expiresAt,
  totalQuestions,
  answeredCount,
  isSaving,
  onTimeExpired,
  onSubmitClick,
  onOpenNavigator,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#F4F1FA]/90 backdrop-blur-md border-b border-purple-500/10 px-4 py-3 sm:py-3.5 transition-all">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Test title & Saved status */}
        <div className="min-w-0 flex-1">
          <h2 className="font-heading font-extrabold text-sm sm:text-base text-[#332F3A] truncate">
            {testName}
          </h2>
          <div className="flex items-center gap-2 text-xs text-[#635F69] mt-0.5">
            <span className="font-medium">
              {answeredCount}/{totalQuestions} answered
            </span>
            <span className="text-gray-300">•</span>
            {isSaving ? (
              <span className="text-purple-600 animate-pulse text-[11px] flex items-center gap-1">
                Saving...
              </span>
            ) : (
              <span className="text-emerald-700 text-[11px] flex items-center gap-0.5 font-medium">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved
              </span>
            )}
          </div>
        </div>

        {/* Center: Timer */}
        <div className="shrink-0">
          <Timer expiresAt={expiresAt} onTimeExpired={onTimeExpired} />
        </div>

        {/* Right: Grid Jump & Finish buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile Grid button */}
          <button
            onClick={onOpenNavigator}
            className="md:hidden flex items-center justify-center p-2 rounded-xl bg-white border border-[#635F69]/20 text-[#332F3A] hover:text-[#7C3AED] min-h-[44px] min-w-[44px]"
            aria-label="Open question navigator"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>

          <Button variant="primary" size="sm" onClick={onSubmitClick} className="px-3.5 sm:px-4">
            Finish
          </Button>
        </div>
      </div>
    </header>
  );
};
