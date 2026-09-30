import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Test, TestAttempt, User } from '../../types';
import { ExamService } from '../../services/examService';
import { ExamHeader } from '../exam/ExamHeader';
import { QuestionCard } from '../exam/QuestionCard';
import { QuestionNavigator } from '../exam/QuestionNavigator';
import { StudentResultView } from './StudentResultView';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { ArrowLeft, ArrowRight, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface ExamInterfaceProps {
  test: Test;
  student: User;
  onExit: () => void;
}

export const ExamInterface: React.FC<ExamInterfaceProps> = ({ test, student, onExit }) => {
  const [attempt, setAttempt] = useState<TestAttempt | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState<boolean>(false);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize or resume attempt
  useEffect(() => {
    const res = ExamService.startOrResumeAttempt(test.id, student);
    if (res.error) {
      setError(res.error);
    } else if (res.attempt) {
      setAttempt(res.attempt);
    }
  }, [test.id, student]);

  // Debounced auto-save handler
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerSave = useCallback(
    (questionId: string, optionId: string | null, isReview: boolean) => {
      if (!attempt) return;
      setIsSaving(true);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        try {
          const updated = ExamService.saveAnswer(attempt.id, questionId, optionId, isReview);
          setAttempt(updated);
        } catch (err) {
          console.error('Autosave error:', err);
        } finally {
          setIsSaving(false);
        }
      }, 250);
    },
    [attempt]
  );

  const handleSelectOption = (optionId: string) => {
    if (!attempt || attempt.status === 'submitted') return;
    const currentQ = attempt.questions[currentIndex];
    if (!currentQ) return;

    const existingAns = attempt.answers[currentQ.id];
    const isReview = existingAns ? existingAns.isMarkedForReview : false;

    // Optimistically update local state immediately for buttery smooth mobile touch feedback
    setAttempt(prev => {
      if (!prev) return null;
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [currentQ.id]: {
            questionId: currentQ.id,
            selectedOptionId: optionId,
            isMarkedForReview: isReview,
            savedAt: Date.now(),
          },
        },
      };
    });

    triggerSave(currentQ.id, optionId, isReview);
  };

  const handleClearAnswer = () => {
    if (!attempt || attempt.status === 'submitted') return;
    const currentQ = attempt.questions[currentIndex];
    if (!currentQ) return;

    const existingAns = attempt.answers[currentQ.id];
    const isReview = existingAns ? existingAns.isMarkedForReview : false;

    setAttempt(prev => {
      if (!prev) return null;
      const newAnswers = { ...prev.answers };
      delete newAnswers[currentQ.id];
      return {
        ...prev,
        answers: newAnswers,
      };
    });

    triggerSave(currentQ.id, null, isReview);
  };

  const handleToggleMarkForReview = () => {
    if (!attempt || attempt.status === 'submitted') return;
    const currentQ = attempt.questions[currentIndex];
    if (!currentQ) return;

    const existingAns = attempt.answers[currentQ.id];
    const selectedOption = existingAns ? existingAns.selectedOptionId : null;
    const newReview = !existingAns?.isMarkedForReview;

    setAttempt(prev => {
      if (!prev) return null;
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [currentQ.id]: {
            questionId: currentQ.id,
            selectedOptionId: selectedOption,
            isMarkedForReview: newReview,
            savedAt: Date.now(),
          },
        },
      };
    });

    triggerSave(currentQ.id, selectedOption, newReview);
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const handleFinalSubmit = () => {
    if (!attempt || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const submitted = ExamService.submitAttempt(attempt.id);
      setAttempt(submitted);
      setIsSubmitModalOpen(false);
    } catch (err: any) {
      console.error('[SUBMIT] Submission error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTimeExpired = () => {
    if (!attempt || attempt.status === 'submitted') return;
    const submitted = ExamService.submitAttempt(attempt.id);
    setAttempt(submitted);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-[#F4F1FA] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-sm border border-purple-500/10">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-heading font-extrabold text-[#332F3A]">Cannot Start Test</h2>
          <p className="text-sm text-[#635F69]">{error}</p>
          <Button variant="secondary" fullWidth onClick={onExit}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen bg-[#F4F1FA] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-3 border-purple-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-heading font-bold text-sm text-[#635F69]">Preparing your personalized test...</p>
        </div>
      </div>
    );
  }

  // If test is submitted, show the Student Result View immediately
  if (attempt.status === 'submitted') {
    return <StudentResultView attempt={attempt} test={test} onBackToDashboard={onExit} />;
  }

  const currentQuestion = attempt.questions[currentIndex];
  const totalQuestions = attempt.questions.length;
  const currentAnswer = currentQuestion ? attempt.answers[currentQuestion.id] : undefined;
  const answeredCount = Object.values(attempt.answers).filter(a => Boolean(a.selectedOptionId)).length;

  return (
    <div className="min-h-screen bg-[#F4F1FA] flex flex-col selection:bg-purple-200">
      {/* Top Fixed Header with Timer and Autosave */}
      <ExamHeader
        testName={test.name}
        expiresAt={attempt.expiresAt}
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        isSaving={isSaving}
        onTimeExpired={handleTimeExpired}
        onSubmitClick={() => setIsSubmitModalOpen(true)}
        onOpenNavigator={() => setIsNavigatorOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-4 gap-6 items-start pb-28 sm:pb-8">
        {/* Left Column: Current Question */}
        <div className="md:col-span-3 w-full">
          {currentQuestion && (
            <QuestionCard
              question={currentQuestion}
              questionIndex={currentIndex}
              totalQuestions={totalQuestions}
              selectedOptionId={currentAnswer?.selectedOptionId || null}
              isMarkedForReview={Boolean(currentAnswer?.isMarkedForReview)}
              onSelectOption={handleSelectOption}
              onToggleMarkForReview={handleToggleMarkForReview}
              onClearAnswer={handleClearAnswer}
            />
          )}

          {/* Desktop Navigation buttons under question card */}
          <div className="hidden sm:flex items-center justify-between gap-3 mt-6 max-w-3xl mx-auto px-1">
            <Button
              variant="secondary"
              size="md"
              disabled={currentIndex === 0}
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
            >
              Previous
            </Button>

            {currentIndex < totalQuestions - 1 ? (
              <Button
                variant="primary"
                size="md"
                onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
              >
                <span>Next Question</span>
                <ArrowRight className="w-4 h-4 ml-1 inline" />
              </Button>
            ) : (
              <Button
                variant="success"
                size="md"
                icon={<CheckCircle2 className="w-4 h-4" />}
                onClick={() => setIsSubmitModalOpen(true)}
              >
                Submit Exam
              </Button>
            )}
          </div>
        </div>

        {/* Right Column: Desktop Question Navigator Drawer */}
        <div className="hidden md:block md:col-span-1 bg-white rounded-3xl p-5 border border-purple-500/10 shadow-[0_4px_16px_-4px_rgba(51,47,58,0.06)] sticky top-20">
          <h3 className="font-heading font-extrabold text-sm text-[#332F3A] mb-3">
            Question Overview
          </h3>
          <QuestionNavigator
            totalQuestions={totalQuestions}
            currentIndex={currentIndex}
            answers={attempt.answers}
            questionIds={attempt.questionIds}
            onSelectIndex={idx => setCurrentIndex(idx)}
          />
        </div>
      </main>

      {/* Mobile Bottom Action Bar (Fixed, high usability touch targets) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-20 bg-white/95 backdrop-blur-md border-t border-purple-500/10 px-4 py-3 shadow-[0_-4px_16px_rgba(51,47,58,0.08)]">
        <div className="flex items-center justify-between gap-2.5">
          <Button
            variant="secondary"
            size="md"
            className="flex-1 min-h-[46px]"
            disabled={currentIndex === 0}
            onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Prev
          </Button>

          <Button
            variant="secondary"
            size="md"
            className="min-h-[46px] px-3 font-medium text-xs text-[#635F69]"
            onClick={() => setIsNavigatorOpen(true)}
          >
            {currentIndex + 1} / {totalQuestions}
          </Button>

          {currentIndex < totalQuestions - 1 ? (
            <Button
              variant="primary"
              size="md"
              className="flex-1 min-h-[46px]"
              onClick={() => setCurrentIndex(prev => Math.min(totalQuestions - 1, prev + 1))}
            >
              Next
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              variant="success"
              size="md"
              className="flex-1 min-h-[46px]"
              onClick={() => setIsSubmitModalOpen(true)}
            >
              Submit
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Navigator Modal */}
      <Modal
        isOpen={isNavigatorOpen}
        onClose={() => setIsNavigatorOpen(false)}
        title="Jump to Question"
        description={`${answeredCount} of ${totalQuestions} questions answered`}
      >
        <div className="py-2">
          <QuestionNavigator
            totalQuestions={totalQuestions}
            currentIndex={currentIndex}
            answers={attempt.answers}
            questionIds={attempt.questionIds}
            onSelectIndex={idx => {
              setCurrentIndex(idx);
              setIsNavigatorOpen(false);
            }}
          />
        </div>
        <div className="pt-4 border-t border-gray-100 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setIsNavigatorOpen(false)}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Submit Confirmation Modal (Strict requirement 19) */}
      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => setIsSubmitModalOpen(false)}
        title="Submit test?"
        description="Once submitted, you cannot change your answers."
        maxWidth="sm"
      >
        <div className="space-y-4 py-2">
          <div className="bg-purple-50/70 border border-purple-100 rounded-2xl p-4 text-xs space-y-1.5 text-[#332F3A]">
            <div className="flex justify-between">
              <span>Answered:</span>
              <span className="font-bold text-purple-900">{answeredCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Unanswered:</span>
              <span className="font-bold text-[#635F69]">{totalQuestions - answeredCount}</span>
            </div>
            <div className="flex justify-between">
              <span>Marked for Review:</span>
              <span className="font-bold text-amber-700">
                {Object.values(attempt.answers).filter(a => a.isMarkedForReview).length}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="secondary"
              fullWidth
              size="md"
              onClick={() => setIsSubmitModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              fullWidth
              size="md"
              disabled={isSubmitting}
              onClick={handleFinalSubmit}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
