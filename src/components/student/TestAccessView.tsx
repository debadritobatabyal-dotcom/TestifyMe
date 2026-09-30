import React, { useState, useEffect } from 'react';
import { Test, User } from '../../types';
import { TestService } from '../../services/testService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Clock, HelpCircle, ShieldAlert, ArrowLeft, Play, Calendar, AlertCircle, EyeOff, Lock } from 'lucide-react';

export interface TestAccessViewProps {
  testCode: string;
  student?: User | null;
  onStartExam: (test: Test) => void;
  onBack: () => void;
  onRequireLogin?: () => void;
}

export const TestAccessView: React.FC<TestAccessViewProps> = ({
  testCode,
  student,
  onStartExam,
  onBack,
  onRequireLogin,
}) => {
  const [test, setTest] = useState<Test | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  const cleanCode = (testCode || '').trim().toUpperCase();

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    // 1. Immediate synchronous check
    const local = TestService.getTestByAccessCode(cleanCode);
    if (local) {
      setTest(local);
      setLoading(false);
      return;
    }

    // 2. Asynchronous lookup (cross-tab / incognito / live cloud Firestore)
    TestService.resolveTestByCode(cleanCode)
      .then(res => {
        if (!isMounted) return;
        setLoading(false);
        if (res.test) {
          setTest(res.test);
          setError(null);
        } else {
          setError('Test not found. Please check the test code with your teacher.');
        }
      })
      .catch(() => {
        if (!isMounted) return;
        setLoading(false);
        setError('Test not found. Please check the test code with your teacher.');
      });

    return () => {
      isMounted = false;
    };
  }, [cleanCode]);

  // Loading state
  if (loading) {
    return (
      <div className="max-w-md mx-auto p-4 py-12">
        <Card variant="elevated" padding="lg" className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-purple-100 text-[#7C3AED] flex items-center justify-center mx-auto animate-spin">
            <Clock className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-heading font-extrabold text-[#332F3A]">Resolving Examination...</h2>
          <p className="text-xs text-[#635F69]">Looking up test code "{cleanCode}" with faculty registry...</p>
        </Card>
      </div>
    );
  }

  // 1. Test genuinely does not exist (Requirement 8 - State 1)
  if (error || !test) {
    return (
      <div className="max-w-md mx-auto p-4 py-8">
        <Card variant="elevated" padding="lg" className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-heading font-extrabold text-[#332F3A]">Test Code Not Found</h2>
          <p className="text-sm text-[#635F69]">
            Test not found. Please check the test code with your teacher.
          </p>
          <div className="bg-[#FAF8FE] border border-purple-500/10 rounded-xl p-2.5 text-xs font-mono font-bold text-[#7C3AED]">
            Attempted Code: {cleanCode}
          </div>
          <Button variant="secondary" fullWidth onClick={onBack}>
            Back to Portal
          </Button>
        </Card>
      </div>
    );
  }

  const availability = TestService.getTestAvailability(test);

  // 2. Test exists but is not published / draft (Requirement 8 - State 2)
  if (test.status === 'draft' || test.isPublished === false) {
    return (
      <div className="max-w-md mx-auto p-4 py-8">
        <Card variant="elevated" padding="lg" className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto">
            <EyeOff className="w-6 h-6" />
          </div>
          <Badge variant="warning">Unpublished</Badge>
          <h2 className="text-xl font-heading font-extrabold text-[#332F3A]">Test Unavailable</h2>
          <p className="text-sm text-[#635F69]">
            This test is not currently available.
          </p>
          <Button variant="secondary" fullWidth onClick={onBack}>
            Back
          </Button>
        </Card>
      </div>
    );
  }

  // 3. Test scheduled for later (Requirement 8 - State 3)
  if (availability.status === 'not_started') {
    const formattedStartTime = new Date(test.startTime).toLocaleString([], {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="max-w-xl mx-auto p-4 py-6 sm:py-10 space-y-5">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] transition-colors py-1"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <Card variant="elevated" padding="lg" className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-100 text-[#7C3AED] rounded-full">
              Code: {test.testCode || test.accessCode}
            </span>
            <Badge variant="warning">Scheduled</Badge>
          </div>

          <div className="text-center sm:text-left space-y-2">
            <h1 className="text-xl sm:text-2xl font-heading font-black text-[#332F3A]">
              {test.name}
            </h1>
            {test.description && (
              <p className="text-sm text-[#635F69] leading-relaxed">{test.description}</p>
            )}
          </div>

          {/* Scheduled notice card */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-center space-y-2">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center mx-auto">
              <Calendar className="w-5 h-5" />
            </div>
            <h3 className="text-base font-heading font-bold text-amber-900">Test Scheduled</h3>
            <p className="text-xs sm:text-sm font-semibold text-amber-800">
              This test starts on {formattedStartTime}.
            </p>
            <p className="text-xs text-amber-700">
              Please return to this page when the scheduled testing window opens.
            </p>
          </div>

          {/* Specifications Preview */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF8FE] border border-purple-500/10 rounded-2xl p-4 text-xs">
            <div className="space-y-1">
              <div className="text-[#635F69]">Duration</div>
              <p className="font-heading font-extrabold text-[#332F3A] text-sm">{test.durationMinutes} mins</p>
            </div>
            <div className="space-y-1">
              <div className="text-[#635F69]">Total Questions</div>
              <p className="font-heading font-extrabold text-[#332F3A] text-sm">{test.totalQuestions}</p>
            </div>
            <div className="space-y-1">
              <div className="text-[#635F69]">Negative Marking</div>
              <p className="font-heading font-extrabold text-[#332F3A] text-sm">
                {test.negativeMarkingEnabled && test.negativeMarks > 0 ? `-${test.negativeMarks}` : 'None'}
              </p>
            </div>
          </div>

          <Button variant="secondary" fullWidth size="lg" disabled>
            Scheduled — Not Yet Open
          </Button>
        </Card>
      </div>
    );
  }

  // 4. Test expired / window closed (Requirement 8 - State 4)
  if (availability.status === 'closed') {
    return (
      <div className="max-w-md mx-auto p-4 py-8">
        <Card variant="elevated" padding="lg" className="text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 text-gray-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <Badge variant="neutral">Closed</Badge>
          <h2 className="text-xl font-heading font-extrabold text-[#332F3A]">Test Closed</h2>
          <p className="text-sm text-[#635F69]">
            This test is no longer available.
          </p>
          <p className="text-xs text-[#635F69]">
            The examination window closed on {new Date(test.endTime).toLocaleString()}.
          </p>
          <Button variant="secondary" fullWidth onClick={onBack}>
            Back to Portal
          </Button>
        </Card>
      </div>
    );
  }

  // 5. Test currently active! (Requirement 8 - State 5)
  return (
    <div className="max-w-xl mx-auto p-4 py-6 sm:py-10 space-y-5">
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] transition-colors py-1"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <Card variant="elevated" padding="lg" className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-mono font-bold px-3 py-1 bg-purple-100 text-[#7C3AED] rounded-full">
              Code: {test.testCode || test.accessCode}
            </span>
            <Badge variant="success">Test Available</Badge>
          </div>

          <h1 className="text-xl sm:text-2xl font-heading font-black text-[#332F3A]">
            {test.name}
          </h1>
          {test.description && (
            <p className="text-sm text-[#635F69] leading-relaxed">{test.description}</p>
          )}
        </div>

        {/* Exam Specifications Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-[#FAF8FE] border border-purple-500/10 rounded-2xl p-4">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#635F69]">
              <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Duration</span>
            </div>
            <p className="text-base font-heading font-extrabold text-[#332F3A]">
              {test.durationMinutes} mins
            </p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#635F69]">
              <HelpCircle className="w-3.5 h-3.5 text-[#7C3AED]" />
              <span>Questions</span>
            </div>
            <p className="text-base font-heading font-extrabold text-[#332F3A]">
              {test.totalQuestions} Questions
            </p>
            <span className="text-[10px] text-[#635F69] block">
              {test.mcqCount} MCQ • {test.assertionReasonCount} AR
            </span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-[#635F69]">
              <ShieldAlert className="w-3.5 h-3.5 text-rose-500" />
              <span>Negative Mark</span>
            </div>
            <p className="text-base font-heading font-extrabold text-[#332F3A]">
              {test.negativeMarkingEnabled && test.negativeMarks > 0
                ? `-${test.negativeMarks}`
                : test.negativeMarking && test.negativeMarking > 0
                ? `-${test.negativeMarking}`
                : 'None'}
            </p>
          </div>
        </div>

        {/* Schedule window info */}
        <div className="text-xs text-[#635F69] space-y-1 border-t border-gray-100 pt-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-[#7C3AED]" />
            <span>
              <strong className="text-[#332F3A]">Window:</strong>{' '}
              {new Date(test.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} -{' '}
              {new Date(test.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <p className="text-[#635F69] pl-6">
            Date:{' '}
            {new Date(test.startTime).toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })}
          </p>
        </div>

        {/* Action Button: Authenticated vs Unauthenticated */}
        <div className="pt-2">
          {student ? (
            <Button
              variant="primary"
              fullWidth
              size="lg"
              icon={<Play className="w-5 h-5 fill-current" />}
              onClick={() => onStartExam(test)}
            >
              Start Exam Now
            </Button>
          ) : (
            <div className="space-y-2">
              <Button
                variant="primary"
                fullWidth
                size="lg"
                icon={<Lock className="w-4 h-4" />}
                onClick={() => {
                  if (onRequireLogin) onRequireLogin();
                }}
              >
                Sign In as Student to Start Exam
              </Button>
              <p className="text-center text-[11px] text-[#635F69]">
                Student login or quick registration is required to save your answers and record scores.
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};
