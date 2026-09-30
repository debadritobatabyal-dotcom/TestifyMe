import React, { useEffect } from 'react';
import { TestAttempt, Test } from '../../types';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { CheckCircle2, Clock, Award, XCircle, HelpCircle, ArrowLeft } from 'lucide-react';
import confetti from 'canvas-confetti';

export interface StudentResultViewProps {
  attempt: TestAttempt;
  test: Test;
  onBackToDashboard: () => void;
}

export const StudentResultView: React.FC<StudentResultViewProps> = ({
  attempt,
  test,
  onBackToDashboard,
}) => {
  const percentage = attempt.percentage ?? 0;
  const isPassing = percentage >= 50;

  useEffect(() => {
    if (isPassing) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 },
        colors: ['#7C3AED', '#DB2777', '#10B981', '#0EA5E9'],
      });
    }
  }, [isPassing]);

  return (
    <div className="min-h-screen bg-[#F4F1FA] py-8 px-4 flex items-center justify-center">
      <div className="w-full max-w-xl space-y-6">
        {/* Main Result Card */}
        <Card variant="elevated" padding="lg" className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-3xl bg-purple-100 flex items-center justify-center text-[#7C3AED] shadow-xs">
            <CheckCircle2 className="w-9 h-9" />
          </div>

          <div className="space-y-1.5">
            <span className="text-xs font-heading font-extrabold uppercase tracking-widest text-[#7C3AED]">
              Test Completed
            </span>
            <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A]">
              Test Submitted Successfully
            </h1>
            <p className="text-xs sm:text-sm text-[#635F69] max-w-md mx-auto">
              Your responses for <span className="font-bold text-[#332F3A]">{test.name}</span> have been recorded.
            </p>
          </div>

          {/* Primary Score Clay Hero */}
          <div className="bg-gradient-to-br from-[#FAF8FE] to-white border border-purple-500/15 rounded-3xl p-6 sm:p-8 shadow-[inset_0_2px_4px_rgba(255,255,255,0.8),0_8px_20px_-6px_rgba(124,58,237,0.1)] space-y-2">
            <span className="text-xs font-heading font-bold text-[#635F69] uppercase tracking-wider">
              Total Score
            </span>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className="text-4xl sm:text-5xl font-heading font-black text-[#7C3AED]">
                {attempt.score ?? 0}
              </span>
              <span className="text-xl sm:text-2xl font-heading font-bold text-[#635F69]/70">
                / {attempt.maxScore ?? test.totalQuestions * (test.positiveMarks || test.marksPerQuestion || 1)}
              </span>
            </div>
            <div className="inline-flex items-center gap-1.5 bg-purple-100/80 text-purple-800 px-3.5 py-1 rounded-full text-xs font-heading font-bold">
              <Award className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>{percentage}% Percentage</span>
            </div>
          </div>

          {/* 3 Metrics: Correct, Incorrect, Unanswered */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3.5">
            {/* Correct */}
            <div className="bg-emerald-50/60 border border-emerald-200/60 rounded-2xl p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center text-emerald-600 mb-1">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <span className="text-xl sm:text-2xl font-heading font-black text-emerald-700 block">
                {attempt.correctCount ?? 0}
              </span>
              <span className="text-[11px] font-heading font-bold text-emerald-800">
                Correct
              </span>
            </div>

            {/* Incorrect */}
            <div className="bg-rose-50/60 border border-rose-200/60 rounded-2xl p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center text-rose-600 mb-1">
                <XCircle className="w-4 h-4" />
              </div>
              <span className="text-xl sm:text-2xl font-heading font-black text-rose-700 block">
                {attempt.incorrectCount ?? 0}
              </span>
              <span className="text-[11px] font-heading font-bold text-rose-800">
                Incorrect
              </span>
            </div>

            {/* Unanswered */}
            <div className="bg-gray-50 border border-gray-200 rounded-2xl p-3 sm:p-4 text-center">
              <div className="flex items-center justify-center text-gray-500 mb-1">
                <HelpCircle className="w-4 h-4" />
              </div>
              <span className="text-xl sm:text-2xl font-heading font-black text-gray-700 block">
                {attempt.unansweredCount ?? 0}
              </span>
              <span className="text-[11px] font-heading font-bold text-gray-600">
                Unanswered
              </span>
            </div>
          </div>

          {/* Timestamp info */}
          <div className="text-xs text-[#635F69] flex items-center justify-center gap-1.5 pt-1">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Submitted on{' '}
              {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A'}
            </span>
          </div>

          {/* Back button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              fullWidth
              size="lg"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={onBackToDashboard}
            >
              Return to Student Dashboard
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};
