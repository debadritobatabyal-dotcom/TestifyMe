import React from 'react';
import { StudentAnswer } from '../../types';
import { Bookmark } from 'lucide-react';

export interface QuestionNavigatorProps {
  totalQuestions: number;
  currentIndex: number;
  answers: Record<string, StudentAnswer>;
  questionIds: string[];
  onSelectIndex: (index: number) => void;
  className?: string;
}

export const QuestionNavigator: React.FC<QuestionNavigatorProps> = ({
  totalQuestions,
  currentIndex,
  answers,
  questionIds,
  onSelectIndex,
  className = '',
}) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[#635F69] px-1">
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-[#7C3AED]" />
          <span>Answered</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-amber-400 flex items-center justify-center text-white text-[8px]">
            <Bookmark className="w-2.5 h-2.5 fill-current" />
          </span>
          <span>Review</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full bg-white border border-[#635F69]/30" />
          <span>Unvisited</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-purple-600 bg-white" />
          <span>Current</span>
        </div>
      </div>

      {/* Grid of 40 Questions (Mobile: 5 to 8 per row, desktop: 8 to 10 per row) */}
      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 max-h-[280px] overflow-y-auto p-1">
        {Array.from({ length: totalQuestions }).map((_, idx) => {
          const qId = questionIds[idx];
          const ans = qId ? answers[qId] : undefined;
          const isAnswered = Boolean(ans?.selectedOptionId);
          const isReview = Boolean(ans?.isMarkedForReview);
          const isCurrent = idx === currentIndex;

          let btnColor = 'bg-white text-[#332F3A] border border-gray-200 hover:border-purple-300';
          if (isAnswered && !isReview) {
            btnColor = 'bg-[#7C3AED] text-white border-[#7C3AED] shadow-xs';
          } else if (isReview) {
            btnColor = 'bg-amber-400 text-amber-950 border-amber-500 font-bold';
          }

          const ringStyle = isCurrent ? 'ring-2 ring-purple-600 ring-offset-2 scale-105 font-extrabold' : '';

          return (
            <button
              key={idx}
              onClick={() => onSelectIndex(idx)}
              className={`relative h-10 w-full rounded-xl flex items-center justify-center text-xs font-heading font-bold transition-all min-h-[40px] cursor-pointer ${btnColor} ${ringStyle}`}
              aria-label={`Question ${idx + 1}, ${isAnswered ? 'Answered' : 'Not answered'}${isReview ? ', Marked for review' : ''}${isCurrent ? ', Current' : ''}`}
            >
              <span>{idx + 1}</span>
              {isReview && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-600 rounded-full flex items-center justify-center text-white">
                  <Bookmark className="w-2 h-2 fill-current" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
