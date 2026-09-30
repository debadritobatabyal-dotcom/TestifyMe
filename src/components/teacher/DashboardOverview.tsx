import React, { useState, useEffect } from 'react';
import { Test, User, TestAttempt } from '../../types';
import { TestService } from '../../services/testService';
import { Storage } from '../../services/storage';
import { ExamService } from '../../services/examService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EmptyState } from '../ui/EmptyState';
import {
  Plus,
  PlayCircle,
  Calendar,
  Users,
  CheckCircle,
  Copy,
  Trash2,
  BarChart2,
  Clock,
  KeyRound,
  RefreshCw,
} from 'lucide-react';

export interface DashboardOverviewProps {
  teacher: User;
  onOpenCreateTest: () => void;
  onSelectTestResults: (test: Test) => void;
  onSelectTestAnalytics: (test: Test) => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  teacher,
  onOpenCreateTest,
  onSelectTestResults,
}) => {
  const [attempts, setAttempts] = useState<TestAttempt[]>(() =>
    ExamService.getAttemptsForTeacher(teacher.id)
  );
  const tests = TestService.getTestsForTeacher(teacher.id);

  // Live real-time subscription for teacher submissions & metrics (Requirements 6, 7, 8, 21)
  useEffect(() => {
    const unsub = ExamService.subscribeToTeacherAttempts(teacher.id, undefined, updatedAttempts => {
      setAttempts(updatedAttempts);
    });
    // Cross-device sync: check for any tests or questions created on other devices
    Storage.syncTeacherFromFirestore(teacher.id);
    return unsub;
  }, [teacher.id]);

  const teacherQuestions = Storage.getQuestions(teacher.id);
  const mySubmissions = attempts.filter(a => a.status === 'submitted');
  const participatingStudents = new Set(mySubmissions.map(a => a.studentId)).size;

  const activeTests = tests.filter(t => t.status === 'active');
  const scheduledTests = tests.filter(t => t.status === 'scheduled');

  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  const handleManualSync = async () => {
    setIsSyncing(true);
    Storage.syncAllToFirestore();
    await Storage.syncTeacherFromFirestore(teacher.id);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncStatus('Synced ✓');
      setTimeout(() => setSyncStatus(null), 3000);
    }, 800);
  };

  const handleDuplicate = (testId: string) => {
    TestService.duplicateTest(testId, teacher.id);
    window.location.reload();
  };

  const handleDelete = (testId: string) => {
    if (confirm('Are you sure you want to delete this test? All recorded submissions will also be deleted.')) {
      TestService.deleteTest(testId, teacher.id);
      window.location.reload();
    }
  };

  const handleCopyLink = (code: string) => {
    const url = `${window.location.origin}/test/${code}`;
    navigator.clipboard.writeText(url);
    alert(`Test link copied to clipboard!\n${url}`);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner and Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-heading font-extrabold uppercase tracking-widest text-[#7C3AED]">
            Faculty Workspace
          </span>
          <h1 className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A]">
            Examinations & Analytics
          </h1>
          <p className="text-xs sm:text-sm text-[#635F69] mt-0.5">
            Logged in as <strong className="text-[#332F3A]">{teacher.name}</strong> ({teacher.email})
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            icon={<RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-[#7C3AED]' : ''}`} />}
            onClick={handleManualSync}
            disabled={isSyncing}
          >
            {syncStatus || (isSyncing ? 'Syncing...' : 'Sync Cloud')}
          </Button>
          <Button
            variant="primary"
            size="md"
            icon={<Plus className="w-4 h-4" />}
            onClick={onOpenCreateTest}
          >
            Create Examination
          </Button>
        </div>
      </div>

      {/* Top-Level 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Active Tests</span>
            <PlayCircle className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-[#7C3AED]">
            {activeTests.length}
          </div>
          <p className="text-[11px] text-[#635F69]">Available now for taking</p>
        </Card>

        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Scheduled Tests</span>
            <Calendar className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-sky-700">
            {scheduledTests.length}
          </div>
          <p className="text-[11px] text-[#635F69]">Upcoming test windows</p>
        </Card>

        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Question Bank</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A]">
            {teacherQuestions.length}
          </div>
          <p className="text-[11px] text-[#635F69]">Questions in your bank</p>
        </Card>

        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Submissions</span>
            <CheckCircle className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-emerald-700">
            {mySubmissions.length}
          </div>
          <p className="text-[11px] text-[#635F69]">{participatingStudents} student participants</p>
        </Card>
      </div>

      {/* Tests Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg sm:text-xl font-heading font-extrabold text-[#332F3A]">
            Examinations
          </h2>
          <span className="text-xs text-[#635F69] font-medium">
            {tests.length} tests total
          </span>
        </div>

        {/* Real Production Empty State (Requirement 37) */}
        {tests.length === 0 ? (
          <EmptyState
            title="No tests created yet"
            description="Create your first timed examination with randomized questions and access code sharing."
            actionText="Create Test"
            onAction={onOpenCreateTest}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {tests.map(test => {
              const testAttempts = attempts.filter(
                a => a.testId === test.id && a.status === 'submitted'
              );
              const avgScore =
                testAttempts.length > 0
                  ? Math.round(
                      (testAttempts.reduce((sum, a) => sum + (a.score || 0), 0) / testAttempts.length) * 10
                    ) / 10
                  : '—';

              return (
                <Card
                  key={test.id}
                  variant="elevated"
                  padding="md"
                  className="flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-2.5">
                    {/* Status & code */}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleCopyLink(test.testCode || test.accessCode)}
                        className="inline-flex items-center gap-1 font-mono text-xs font-bold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors"
                        title="Click to copy student exam link"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>{test.testCode || test.accessCode}</span>
                        <Copy className="w-2.5 h-2.5 text-purple-500" />
                      </button>

                      {test.status === 'active' && <Badge variant="success">Active Now</Badge>}
                      {test.status === 'scheduled' && <Badge variant="warning">Scheduled</Badge>}
                      {test.status === 'closed' && <Badge variant="neutral">Closed</Badge>}
                    </div>

                    {/* Test Title & Description */}
                    <div>
                      <h3 className="text-base sm:text-lg font-heading font-extrabold text-[#332F3A] line-clamp-1">
                        {test.name}
                      </h3>
                      {test.description && (
                        <p className="text-xs text-[#635F69] line-clamp-2 mt-0.5 leading-relaxed">
                          {test.description}
                        </p>
                      )}
                    </div>

                    {/* Meta stats */}
                    <div className="grid grid-cols-3 gap-2 bg-[#FAF8FE] border border-purple-500/10 rounded-2xl p-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-[#635F69] block font-heading">Questions</span>
                        <span className="font-heading font-black text-[#332F3A]">
                          {test.totalQuestions} Qs
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#635F69] block font-heading">Submissions</span>
                        <span className="font-heading font-black text-[#7C3AED]">
                          {testAttempts.length}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-[#635F69] block font-heading">Avg Score</span>
                        <span className="font-heading font-black text-emerald-700">
                          {avgScore}
                        </span>
                      </div>
                    </div>

                    {/* Window info */}
                    <div className="flex items-center gap-1.5 text-[11px] text-[#635F69] pt-1">
                      <Clock className="w-3.5 h-3.5 text-[#7C3AED]" />
                      <span>
                        {new Date(test.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(test.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} ({test.durationMinutes}m)
                      </span>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-2">
                    <Button
                      variant="primary"
                      size="sm"
                      icon={<BarChart2 className="w-3.5 h-3.5" />}
                      onClick={() => onSelectTestResults(test)}
                    >
                      View Results ({testAttempts.length})
                    </Button>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDuplicate(test.id)}
                        className="p-1.5 rounded-lg text-[#635F69] hover:text-[#7C3AED] hover:bg-purple-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Duplicate test"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDelete(test.id)}
                        className="p-1.5 rounded-lg text-[#635F69] hover:text-rose-600 hover:bg-rose-50 transition-colors min-h-[36px] min-w-[36px] flex items-center justify-center"
                        title="Delete test"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
