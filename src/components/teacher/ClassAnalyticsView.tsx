import React, { useState, useEffect } from 'react';
import { Test, TestAttempt } from '../../types';
import { Storage } from '../../services/storage';
import { ExamService } from '../../services/examService';
import { AnalyticsService } from '../../services/analyticsService';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { ExportModal } from './ExportModal';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  Award,
  Users,
  Target,
  AlertTriangle,
} from 'lucide-react';

export interface ClassAnalyticsViewProps {
  test: Test;
  onBack: () => void;
}

export const ClassAnalyticsView: React.FC<ClassAnalyticsViewProps> = ({ test, onBack }) => {
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false);
  const [attempts, setAttempts] = useState<TestAttempt[]>(() =>
    Storage.getAttempts(test.id, test.ownerId)
  );

  // Live real-time subscription for analytics updates (Requirements 6, 7, 8, 13, 17)
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

  const analytics = AnalyticsService.getClassAnalytics(test.id, test.ownerId, attempts);

  return (
    <div className="space-y-6">
      {/* Top action header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-heading font-bold text-[#635F69] hover:text-[#7C3AED] transition-colors py-1 self-start"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Submissions</span>
        </button>

        <Button
          variant="primary"
          size="sm"
          icon={<Download className="w-4 h-4" />}
          onClick={() => setIsExportOpen(true)}
        >
          Export Analytics
        </Button>
      </div>

      {/* Summary Title */}
      <div>
        <h1 className="text-xl sm:text-2xl font-heading font-extrabold text-[#332F3A]">
          Class Analytics & Insights
        </h1>
        <p className="text-xs sm:text-sm text-[#635F69]">
          Performance summary and question accuracy breakdown for {test.name}.
        </p>
      </div>

      {/* Top 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Average Score */}
        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Average Score</span>
            <TrendingUp className="w-4 h-4 text-[#7C3AED]" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-[#7C3AED]">
            {analytics.averageScore}
            <span className="text-xs font-normal text-[#635F69] ml-1">/ 40</span>
          </div>
          <p className="text-[11px] text-[#635F69]">Avg: {analytics.averagePercentage}%</p>
        </Card>

        {/* Highest Score */}
        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Highest Score</span>
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-emerald-700">
            {analytics.highestScore}
            <span className="text-xs font-normal text-[#635F69] ml-1">/ 40</span>
          </div>
          <p className="text-[11px] text-[#635F69]">Top performer mark</p>
        </Card>

        {/* Median Score */}
        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Median Score</span>
            <Target className="w-4 h-4 text-sky-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-[#332F3A]">
            {analytics.medianScore}
            <span className="text-xs font-normal text-[#635F69] ml-1">/ 40</span>
          </div>
          <p className="text-[11px] text-[#635F69]">Lowest: {analytics.lowestScore}</p>
        </Card>

        {/* Submissions */}
        <Card variant="flat" padding="md" className="space-y-1">
          <div className="flex items-center justify-between text-[#635F69]">
            <span className="text-xs font-heading font-bold">Submissions</span>
            <Users className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl sm:text-3xl font-heading font-black text-[#7C3AED]">
            {analytics.totalSubmissions}
            <span className="text-xs font-normal text-[#635F69] ml-1">/ {analytics.totalStudents}</span>
          </div>
          <p className="text-[11px] text-[#635F69]">Students completed</p>
        </Card>
      </div>

      {/* Question Difficulty & Accuracy Table (Section 22) */}
      <div className="bg-white rounded-[24px] border border-purple-500/10 shadow-[0_8px_24px_-8px_rgba(124,58,237,0.06)] p-5 sm:p-6 space-y-4">
        <div>
          <h3 className="text-base sm:text-lg font-heading font-extrabold text-[#332F3A] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Question Accuracy Analysis (Hardest Questions First)
          </h3>
          <p className="text-xs text-[#635F69] mt-0.5">
            Identify questions that students struggled with the most to focus on in class reviews.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-[#FAF8FE]/80 font-heading font-extrabold text-[#635F69]">
                <th className="py-3 px-3">#</th>
                <th className="py-3 px-4">Question Text</th>
                <th className="py-3 px-3">Type</th>
                <th className="py-3 px-3 text-center">Attempts</th>
                <th className="py-3 px-3 text-center text-emerald-700">Correct</th>
                <th className="py-3 px-3 text-center text-rose-700">Incorrect</th>
                <th className="py-3 px-4 text-right">Accuracy</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {analytics.questionMetrics.map((m, idx) => {
                const isChallenging = m.accuracy < 60;
                return (
                  <tr key={m.questionId} className="hover:bg-purple-50/30 transition-colors">
                    <td className="py-3 px-3 font-heading font-bold text-[#635F69]">{idx + 1}</td>
                    <td className="py-3 px-4 max-w-xs sm:max-w-md">
                      <p className="font-medium text-[#332F3A] line-clamp-1">{m.questionText}</p>
                      <span className="text-[11px] text-[#635F69]">{m.subject || 'General'}</span>
                    </td>
                    <td className="py-3 px-3">
                      <Badge variant={m.type === 'ASSERTION_REASON' ? 'secondary' : 'primary'} size="sm">
                        {m.type === 'ASSERTION_REASON' ? 'A/R' : 'MCQ'}
                      </Badge>
                    </td>
                    <td className="py-3 px-3 text-center font-medium">{m.attempts}</td>
                    <td className="py-3 px-3 text-center font-bold text-emerald-700">{m.correct}</td>
                    <td className="py-3 px-3 text-center font-bold text-rose-700">{m.incorrect}</td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-2 bg-gray-100 rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              isChallenging ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${m.accuracy}%` }}
                          />
                        </div>
                        <span
                          className={`font-heading font-extrabold ${
                            isChallenging ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {m.accuracy}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} test={test} />
    </div>
  );
};
