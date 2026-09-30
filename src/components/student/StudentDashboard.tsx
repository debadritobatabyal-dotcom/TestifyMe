import React, { useState } from 'react';
import { User, Test } from '../../types';
import { TestService } from '../../services/testService';
import { Storage } from '../../services/storage';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import { KeyRound, ArrowRight, Clock, Award, CheckCircle } from 'lucide-react';

export interface StudentDashboardProps {
  student: User;
  onEnterTestCode: (code: string) => void;
  onSelectTest: (test: Test) => void;
}

export const StudentDashboard: React.FC<StudentDashboardProps> = ({
  student,
  onEnterTestCode,
  onSelectTest,
}) => {
  const [accessCodeInput, setAccessCodeInput] = useState<string>('');
  const [codeError, setCodeError] = useState<string | null>(null);

  const tests = TestService.getAllTests();
  const pastAttempts = Storage.getAttempts().filter(
    a => a.studentId === student.id && a.status === 'submitted'
  );

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = accessCodeInput.trim().toUpperCase();
    if (!clean) {
      setCodeError('Please enter a test access code.');
      return;
    }

    const test = TestService.getTestByAccessCode(clean);
    if (!test) {
      const res = await TestService.resolveTestByCode(clean);
      if (!res.test) {
        setCodeError(`No examination found matching test code "${clean}". Please check with your teacher.`);
        return;
      }
    }

    setCodeError(null);
    onEnterTestCode(clean);
  };

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Student Welcome Banner (Persistent profile loaded automatically, Requirement 1 & 27) */}
      <div className="bg-gradient-to-r from-[#7C3AED] to-[#8B5CF6] text-white rounded-[28px] p-6 sm:p-8 shadow-[0_12px_30px_-10px_rgba(124,58,237,0.35)] relative overflow-hidden">
        <div className="relative z-10 space-y-2">
          <span className="inline-block text-xs font-heading font-extrabold uppercase tracking-widest text-purple-200">
            Student Portal
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-black">
            Welcome, {student.name}
          </h1>
          <p className="text-xs sm:text-sm text-purple-100/90 font-medium">
            Student ID / Roll No: <strong className="text-white">{student.studentId || 'N/A'}</strong> • {student.email}
          </p>
        </div>
      </div>

      {/* Access Code Entry */}
      <Card variant="elevated" padding="lg">
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-heading font-extrabold text-[#332F3A] flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#7C3AED]" />
              Enter Test Access Code
            </h2>
            <p className="text-xs sm:text-sm text-[#635F69]">
              Enter the unique access code provided by your teacher (e.g. <span className="font-mono font-bold text-purple-700">CHEM-7X92</span>) to access your exam.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <Input
                placeholder="e.g. CHEM-7X92"
                value={accessCodeInput}
                onChange={e => {
                  setAccessCodeInput(e.target.value.toUpperCase());
                  if (codeError) setCodeError(null);
                }}
                error={codeError || undefined}
                className="font-mono text-base uppercase tracking-wider"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="md"
              className="sm:w-auto min-w-[140px]"
              icon={<ArrowRight className="w-4 h-4" />}
            >
              Enter Test
            </Button>
          </div>
        </form>
      </Card>

      {/* Available & Scheduled Tests */}
      <div className="space-y-4">
        <h2 className="text-lg font-heading font-extrabold text-[#332F3A]">
          Available Examinations
        </h2>

        {tests.length === 0 ? (
          <EmptyState
            title="No tests available"
            description="Your teacher has not published any examinations yet. Check back soon or enter a test access code above."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map(test => {
              const availability = TestService.getTestAvailability(test);
              const myAttempt = Storage.getStudentAttemptForTest(student.id, test.id);
              const isSubmitted = myAttempt?.status === 'submitted';

              return (
                <Card
                  key={test.id}
                  variant="interactive"
                  padding="md"
                  className="flex flex-col justify-between space-y-4"
                  onClick={() => onSelectTest(test)}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-purple-800 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                        {test.testCode || test.accessCode}
                      </span>
                      {isSubmitted ? (
                        <Badge variant="success">Submitted</Badge>
                      ) : availability.status === 'active' ? (
                        <Badge variant="primary">Active Now</Badge>
                      ) : availability.status === 'not_started' ? (
                        <Badge variant="warning">Upcoming</Badge>
                      ) : (
                        <Badge variant="neutral">Closed</Badge>
                      )}
                    </div>

                    <h3 className="text-base font-heading font-bold text-[#332F3A] line-clamp-1">
                      {test.name}
                    </h3>
                    {test.description && (
                      <p className="text-xs text-[#635F69] line-clamp-2 leading-relaxed">
                        {test.description}
                      </p>
                    )}
                  </div>

                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-[#635F69]">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>{test.durationMinutes} mins</span>
                    </div>
                    <span>{test.totalQuestions} Questions</span>
                    <span className="font-heading font-bold text-[#7C3AED] hover:underline flex items-center gap-1">
                      {isSubmitted ? 'View Score' : 'Start'}
                      <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Real Past Submissions */}
      {pastAttempts.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="text-lg font-heading font-extrabold text-[#332F3A] flex items-center gap-2">
            <Award className="w-5 h-5 text-[#7C3AED]" />
            Your Test History
          </h2>

          <div className="space-y-2.5">
            {pastAttempts.map(att => {
              const test = TestService.getTestById(att.testId);
              return (
                <div
                  key={att.id}
                  className="bg-white rounded-2xl p-4 border border-purple-500/10 flex items-center justify-between gap-3 shadow-xs"
                >
                  <div className="space-y-0.5">
                    <h4 className="font-heading font-bold text-sm text-[#332F3A]">
                      {test?.name || 'Examination'}
                    </h4>
                    <p className="text-xs text-[#635F69] flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                      Submitted on {new Date(att.submittedAt || att.startedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-base font-heading font-black text-[#7C3AED]">
                      {att.score} / {att.maxScore}
                    </span>
                    <span className="block text-[11px] font-bold text-emerald-700">
                      {att.percentage}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
