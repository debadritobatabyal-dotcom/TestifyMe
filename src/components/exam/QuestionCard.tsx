import React from 'react';
import { StudentSafeQuestion } from '../../types';
import { Badge } from '../ui/Badge';
import { Bookmark, BookmarkCheck } from 'lucide-react';

export interface QuestionCardProps {
  question: StudentSafeQuestion;
  questionIndex: number;
  totalQuestions: number;
  selectedOptionId: string | null;
  isMarkedForReview: boolean;
  onSelectOption: (optionId: string) => void;
  onToggleMarkForReview: () => void;
  onClearAnswer: () => void;
}

export const QuestionCard: React.FC<QuestionCardProps> = ({
  question,
  questionIndex,
  totalQuestions,
  selectedOptionId,
  isMarkedForReview,
  onSelectOption,
  onToggleMarkForReview,
  onClearAnswer,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      {/* Top Meta info */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="font-heading font-extrabold text-base sm:text-lg text-[#332F3A]">
            Question {questionIndex + 1}
            <span className="text-[#635F69] font-normal text-sm sm:text-base"> of {totalQuestions}</span>
          </span>
          {question.subject && (
            <Badge variant="primary" size="sm">
              {question.subject}
            </Badge>
          )}
          {question.type === 'ASSERTION_REASON' && (
            <Badge variant="secondary" size="sm">
              Assertion-Reason
            </Badge>
          )}
        </div>

        {/* Mark for review toggle */}
        <button
          onClick={onToggleMarkForReview}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-heading font-bold transition-colors min-h-[36px] ${
            isMarkedForReview
              ? 'bg-amber-100 text-amber-900 border border-amber-300'
              : 'bg-white text-[#635F69] border border-gray-200 hover:border-amber-300 hover:text-amber-800'
          }`}
          aria-label={isMarkedForReview ? 'Unmark for review' : 'Mark for review'}
        >
          {isMarkedForReview ? (
            <BookmarkCheck className="w-4 h-4 text-amber-600" />
          ) : (
            <Bookmark className="w-4 h-4 text-[#635F69]" />
          )}
          <span>{isMarkedForReview ? 'Marked for Review' : 'Mark for Review'}</span>
        </button>
      </div>

      {/* Main Question Surface */}
      <div className="bg-white rounded-[24px] sm:rounded-[28px] border border-purple-500/10 p-5 sm:p-7 shadow-[0_8px_24px_-6px_rgba(124,58,237,0.06)] space-y-5">
        {/* If Assertion-Reason, show formatted statements */}
        {question.type === 'ASSERTION_REASON' ? (
          <div className="space-y-3.5">
            <h4 className="font-heading font-bold text-sm sm:text-base text-[#7C3AED]">
              {question.questionText}
            </h4>

            <div className="bg-[#FAF8FE] border border-purple-100 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-purple-700">
                Assertion (A):
              </span>
              <p className="text-sm sm:text-base text-[#332F3A] font-medium leading-relaxed">
                {question.assertion}
              </p>
            </div>

            <div className="bg-[#FAF8FE] border border-purple-100 rounded-2xl p-4 space-y-1">
              <span className="text-xs font-heading font-extrabold uppercase tracking-wider text-purple-700">
                Reason (R):
              </span>
              <p className="text-sm sm:text-base text-[#332F3A] font-medium leading-relaxed">
                {question.reason}
              </p>
            </div>
          </div>
        ) : (
          /* Normal MCQ Question Text */
          <div className="space-y-1">
            <p className="text-base sm:text-lg font-medium text-[#332F3A] leading-relaxed">
              {question.questionText}
            </p>
          </div>
        )}

        {/* Options */}
        <div className="space-y-3 pt-2">
          {question.options.map((option, idx) => {
            const isSelected = selectedOptionId === option.id;
            const letterLabel = String.fromCharCode(65 + idx); // A, B, C, D

            return (
              <div
                key={option.id}
                onClick={() => onSelectOption(option.id)}
                className={`clay-option-card flex items-start sm:items-center gap-3.5 p-3.5 sm:p-4 ${
                  isSelected ? 'selected' : ''
                }`}
                role="radio"
                aria-checked={isSelected}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === ' ' || e.key === 'Enter') {
                    e.preventDefault();
                    onSelectOption(option.id);
                  }
                }}
              >
                {/* Radio Circle */}
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 sm:mt-0 font-heading text-xs font-bold transition-all ${
                    isSelected
                      ? 'bg-[#7C3AED] text-white shadow-sm ring-2 ring-purple-300'
                      : 'bg-gray-100 text-[#635F69] border border-gray-300'
                  }`}
                >
                  {letterLabel}
                </div>

                {/* Option Text */}
                <span className={`text-sm sm:text-base leading-snug ${isSelected ? 'font-medium text-purple-950' : 'text-[#332F3A]'}`}>
                  {option.text}
                </span>
              </div>
            );
          })}
        </div>

        {/* Clear Option Footer */}
        {selectedOptionId && (
          <div className="pt-2 flex justify-end">
            <button
              onClick={onClearAnswer}
              className="text-xs font-medium text-[#635F69] hover:text-rose-600 transition-colors py-1 px-2.5 rounded-lg hover:bg-rose-50"
            >
              Clear response
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
