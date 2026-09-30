import React, { useState, useEffect } from 'react';
import { Test, StudentAttemptSummary, DetailedStudentResponse, TestAttempt } from '../../types';
import { Storage } from '../../services/storage';
import { ExamService } from '../../services/examService';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { ExportModal } from './ExportModal';
import {
  ArrowLeft,
  Download,
  BarChart3,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Clock,
  Eye,
} from 'lucide-react';

export interface TestResultsViewProps {
  test: Test;
  onBack: () => void;
  onViewAnalytics: () => void;
}

export const TestResultsView: React.FC<TestResultsViewProps> = ({
  test,
  onBack,
  onViewAnalytics,
}) => {
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [selectedStudentName, setSelectedStudentName] = useState<string>('');
  const [studentResponses, setStudentResponses] = useState<DetailedStudentResponse[]>([]);
  const [attempts, setAttempts] = useState<TestAttempt[]>(() =>
    Storage.getAttempts(test.id, test.ownerId)
  );

  // Live real-time subscription for this specific test (Requirements 6, 7, 8, 14, 15)
  useEffect(() => {
    const unsub = ExamService.subscribeToTeacherAttempts(
      test.ownerId || '',
      test.id,
      updatedAttempts => {
        setAttempts(updatedAttempts);
      }
    );
    return unsub;
  }, [test.id, test.ownerId]);

  const summaries: StudentAttemptSummary[] = ExamService.getTestAttemptSummaries(
    test.id,
    test.ownerId,
    attempts
  );

  const handleOpenStudentResponseSheet = (summary: StudentAttemptSummary) => {
    setSelectedAttemptId(summary.attemptId);
    setSelectedStudentName(summary.studentName);
    const targetAttempt = attempts.find(a => a.id === summary.attemptId);
    const responses = ExamService.getDetailedStudentResponses(summary.attemptId, targetAttempt);
    setStudentResponses(responses);
  };

  const submittedCount = summaries.filter(s => s.status === 'submitted').length;
  const inProgressCount = summaries.filter(s => s.status === 'in_progress').length;

  return (
    <div className="space-y-6">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] transition-colors py-1 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<BarChart3 className="w-4 h-4 text-[#7C3AED]" />}
            onClick={onViewAnalytics}
          >
            Class Analytics
          </Button>

          <Button
            variant="primary"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={() => setIsExportOpen(true)}
          >
            Export Results
          </Button>
        </div>
      </div>

      {/* Test summary card */}
      <Card variant="elevated" padding="md" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              Code: {test.accessCode}
            </span>
            <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-[#332F3A] mt-1">
              {test.name} — Student Submissions
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="primary" size="md">
              {submittedCount} Submitted {inProgressCount > 0 ? `(${inProgressCount} in progress)` : ''}
            </Badge>
          </div>
        </div>
        <p className="text-xs text-[#635F69]">
          Live responses update automatically. Click any student below to inspect their full question-by-question response sheet.
        </p>
      </Card>

      {/* Submissions List */}
      {summaries.length === 0 ? (
        <EmptyState
          icon={<Clock className="w-7 h-7" />}
          title="No submissions yet"
          description="Students have not started or submitted any attempts for this examination yet."
        />
      ) : (
        <div className="bg-white rounded-[24px] border border-purple-500/10 shadow-[0_8px_24px_-8px_rgba(124,58,237,0.06)] overflow-hidden">
          {/* Responsive Table / Card Container */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-[#FAF8FE]/80 font-heading font-extrabold text-[#635F69] text-xs">
                  <th className="py-3 px-4 sm:px-6">Student</th>
                  <th className="py-3 px-3 text-center">Status</th>
                  <th className="py-3 px-3 text-center">Attempted</th>
                  <th className="py-3 px-3 text-center text-emerald-700">Correct</th>
                  <th className="py-3 px-3 text-center text-rose-700">Wrong</th>
                  <th className="py-3 px-3 text-center text-gray-500">Unanswered</th>
                  <th className="py-3 px-3 text-right">Score</th>
                  <th className="py-3 px-3 text-right">Pct (%)</th>
                  <th className="py-3 px-4 text-center">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summaries.map(s => {
                  const isSubmitted = s.status === 'submitted';
                  return (
                    <tr
                      key={s.attemptId}
                      className="hover:bg-purple-50/40 transition-colors cursor-pointer"
                      onClick={() => handleOpenStudentResponseSheet(s)}
                    >
                      <td className="py-3.5 px-4 sm:px-6">
                        <p className="font-heading font-bold text-[#332F3A]">{s.studentName}</p>
                        <p className="text-[11px] text-[#635F69]">
                          {s.studentRollNumber ? `${s.studentRollNumber} • ` : ''}
                          {s.studentEmail}
                        </p>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        {isSubmitted ? (
                          <Badge variant="success" size="sm">Submitted</Badge>
                        ) : s.status === 'in_progress' ? (
                          <Badge variant="primary" size="sm">In Progress</Badge>
                        ) : (
                          <Badge variant="warning" size="sm">Expired</Badge>
                        )}
                      </td>
                      <td className="py-3.5 px-3 text-center font-medium text-[#332F3A]">
                        {s.attemptedCount} / {test.totalQuestions || 40}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-emerald-700">
                        {isSubmitted ? s.correctCount : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center font-bold text-rose-700">
                        {isSubmitted ? s.incorrectCount : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-center text-[#635F69]">
                        {isSubmitted ? s.unansweredCount : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-heading font-black text-[#7C3AED]">
                        {isSubmitted ? `${s.score} / ${s.maxScore}` : '—'}
                      </td>
                      <td className="py-3.5 px-3 text-right font-bold text-[#332F3A]">
                        {isSubmitted ? `${s.percentage}%` : 'In progress'}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <Button
                          variant="secondary"
                          size="sm"
                          icon={<Eye className="w-3.5 h-3.5 text-[#7C3AED]" />}
                          onClick={e => {
                            e.stopPropagation();
                            handleOpenStudentResponseSheet(s);
                          }}
                        >
                          Inspect
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Teacher Detailed Student Response Sheet Modal (Section 21) */}
      <Modal
        isOpen={Boolean(selectedAttemptId)}
        onClose={() => setSelectedAttemptId(null)}
        title={`Response Sheet: ${selectedStudentName}`}
        description="Detailed question-by-question breakdown of student responses and correct answers."
        maxWidth="2xl"
      >
        <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto pr-1">
          {studentResponses.map((r, idx) => (
            <div
              key={r.questionId}
              className={`p-4 rounded-2xl border text-xs sm:text-sm space-y-2.5 transition-all ${
                r.isCorrect
                  ? 'bg-emerald-50/40 border-emerald-200'
                  : r.isUnanswered
                  ? 'bg-gray-50 border-gray-200'
                  : 'bg-rose-50/40 border-rose-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-heading font-extrabold text-[#332F3A]">
                  Question {idx + 1}
                  <span className="font-normal text-[#635F69] ml-1.5">({r.type})</span>
                </span>
                {r.isCorrect ? (
                  <Badge variant="success">
                    <CheckCircle2 className="w-3 h-3 inline mr-1" />
                    Correct (+{r.marksAwarded})
                  </Badge>
                ) : r.isUnanswered ? (
                  <Badge variant="neutral">
                    <HelpCircle className="w-3 h-3 inline mr-1" />
                    Unanswered (0)
                  </Badge>
                ) : (
                  <Badge variant="danger">
                    <XCircle className="w-3 h-3 inline mr-1" />
                    Incorrect ({r.marksAwarded})
                  </Badge>
                )}
              </div>

              {/* Question Text / Assertion-Reason details */}
              {r.type === 'ASSERTION_REASON' ? (
                <div className="space-y-1.5 bg-white/80 p-3 rounded-xl border border-gray-100">
                  <p className="font-medium text-[#332F3A]">
                    <strong>Assertion:</strong> {r.assertion}
                  </p>
                  <p className="font-medium text-[#332F3A]">
                    <strong>Reason:</strong> {r.reason}
                  </p>
                </div>
              ) : (
                <p className="font-medium text-[#332F3A] leading-relaxed">{r.questionText}</p>
              )}

              {/* Student choice vs Correct answer */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs pt-1">
                <div className="bg-white p-2.5 rounded-xl border border-gray-200">
                  <span className="text-[#635F69] block">Student Selection:</span>
                  <span
                    className={`font-heading font-bold ${
                      r.isCorrect ? 'text-emerald-700' : r.isUnanswered ? 'text-gray-500' : 'text-rose-700'
                    }`}
                  >
                    {r.selectedOptionId ? `Option ${r.selectedOptionId}` : 'None (Unanswered)'}
                  </span>
                </div>

                <div className="bg-white p-2.5 rounded-xl border border-emerald-300">
                  <span className="text-[#635F69] block">Correct Answer:</span>
                  <span className="font-heading font-bold text-emerald-800">
                    Option {r.correctAnswer}
                  </span>
                </div>
              </div>

              {r.explanation && (
                <p className="text-[11px] text-[#635F69] italic bg-white/60 p-2 rounded-lg">
                  <strong>Explanation:</strong> {r.explanation}
                </p>
              )}
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-gray-100 flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => setSelectedAttemptId(null)}>
            Close
          </Button>
        </div>
      </Modal>

      {/* Export Modal */}
      <ExportModal
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        test={test}
      />
    </div>
  );
};
