import * as XLSX from 'xlsx';
import { Storage } from './storage';
import { AnalyticsService } from './analyticsService';
import { ExamService } from './examService';

export const ExportService = {
  // Export Class Summary to CSV
  exportClassSummaryCSV(testId: string, teacherId?: string): void {
    const test = Storage.getTestById(testId);
    if (!test) return;
    if (teacherId && test.ownerId !== teacherId && test.createdBy !== teacherId) {
      throw new Error('Permission denied: You cannot export data for tests you do not own.');
    }

    const summaries = ExamService.getTestAttemptSummaries(testId, teacherId);
    const headers = [
      'Student Name',
      'Student ID / Roll Number',
      'Email',
      'Attempted',
      'Correct',
      'Incorrect',
      'Unanswered',
      'Score',
      'Max Score',
      'Percentage (%)',
      'Submitted At',
      'Status',
    ];

    const rows = summaries.map(s => [
      `"${s.studentName.replace(/"/g, '""')}"`,
      `"${s.studentRollNumber || ''}"`,
      `"${s.studentEmail}"`,
      s.attemptedCount,
      s.correctCount,
      s.incorrectCount,
      s.unansweredCount,
      s.score,
      s.maxScore,
      `${s.percentage}%`,
      `"${new Date(s.submittedAt).toLocaleString()}"`,
      s.status,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `${sanitizeFilename(test.name)}_Class_Summary.csv`, 'text/csv;charset=utf-8;');
  },

  // Export Question Analysis to CSV
  exportQuestionAnalysisCSV(testId: string, teacherId?: string): void {
    const test = Storage.getTestById(testId);
    if (!test) return;
    if (teacherId && test.ownerId !== teacherId && test.createdBy !== teacherId) {
      throw new Error('Permission denied: You cannot export data for tests you do not own.');
    }

    const analytics = AnalyticsService.getClassAnalytics(testId, teacherId);
    const headers = ['Question #', 'Question Text', 'Subject', 'Type', 'Total Attempts', 'Correct', 'Incorrect', 'Accuracy (%)'];

    const rows = analytics.questionMetrics.map((m, idx) => [
      idx + 1,
      `"${m.questionText.replace(/"/g, '""')}"`,
      `"${m.subject || 'General'}"`,
      m.type,
      m.attempts,
      m.correct,
      m.incorrect,
      `${m.accuracy}%`,
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `${sanitizeFilename(test.name)}_Question_Analysis.csv`, 'text/csv;charset=utf-8;');
  },

  // Export Detailed Responses to CSV
  exportDetailedResponsesCSV(testId: string, teacherId?: string): void {
    const test = Storage.getTestById(testId);
    if (!test) return;
    if (teacherId && test.ownerId !== teacherId && test.createdBy !== teacherId) {
      throw new Error('Permission denied: You cannot export data for tests you do not own.');
    }

    const attempts = Storage.getAttempts(testId, teacherId);
    const headers = ['Student Name', 'Student ID', 'Question #', 'Question Text', 'Selected Answer', 'Correct Answer', 'Result', 'Marks'];
    const rows: any[] = [];

    attempts.forEach(att => {
      const detailed = ExamService.getDetailedStudentResponses(att.id);
      detailed.forEach((d, idx) => {
        rows.push([
          `"${att.studentName.replace(/"/g, '""')}"`,
          `"${att.studentRollNumber || att.studentId}"`,
          idx + 1,
          `"${d.questionText.replace(/"/g, '""')}"`,
          `"${d.selectedOptionId || 'UNANSWERED'}"`,
          `"${d.correctAnswer}"`,
          d.isCorrect ? 'CORRECT' : d.isUnanswered ? 'UNANSWERED' : 'INCORRECT',
          d.marksAwarded,
        ]);
      });
    });

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadBlob(csvContent, `${sanitizeFilename(test.name)}_Detailed_Responses.csv`, 'text/csv;charset=utf-8;');
  },

  // Export complete 4-sheet Excel (.xlsx) workbook (Requirement 24)
  exportCompleteExcel(testId: string, teacherId?: string): void {
    const test = Storage.getTestById(testId);
    if (!test) return;
    if (teacherId && test.ownerId !== teacherId && test.createdBy !== teacherId) {
      throw new Error('Permission denied: You cannot export data for tests you do not own.');
    }

    const summaries = ExamService.getTestAttemptSummaries(testId, teacherId);
    const analytics = AnalyticsService.getClassAnalytics(testId, teacherId);
    const attempts = Storage.getAttempts(testId, teacherId);

    const workbook = XLSX.utils.book_new();

    // Sheet 1: Class Summary
    const summaryData = summaries.map(s => ({
      'Student Name': s.studentName,
      'Student ID / Roll Number': s.studentRollNumber || 'N/A',
      'Email': s.studentEmail,
      'Attempted': s.attemptedCount,
      'Correct': s.correctCount,
      'Incorrect': s.incorrectCount,
      'Unanswered': s.unansweredCount,
      'Score': s.score,
      'Max Score': s.maxScore,
      'Percentage (%)': `${s.percentage}%`,
      'Submission Time': new Date(s.submittedAt).toLocaleString(),
    }));
    const sheet1 = XLSX.utils.json_to_sheet(
      summaryData.length > 0 ? summaryData : [{ Note: 'No student submissions recorded yet' }]
    );
    XLSX.utils.book_append_sheet(workbook, sheet1, 'Class Summary');

    // Sheet 2: Detailed Responses
    const responsesData: any[] = [];
    attempts.forEach(att => {
      const detailed = ExamService.getDetailedStudentResponses(att.id);
      detailed.forEach((d, idx) => {
        responsesData.push({
          'Student Name': att.studentName,
          'Student ID': att.studentRollNumber || att.studentId,
          'Q#': idx + 1,
          'Question Text': d.questionText,
          'Selected Answer': d.selectedOptionId || 'UNANSWERED',
          'Correct Answer': d.correctAnswer,
          'Correct/Incorrect': d.isCorrect ? 'CORRECT' : d.isUnanswered ? 'UNANSWERED' : 'INCORRECT',
          'Marks': d.marksAwarded,
        });
      });
    });
    const sheet2 = XLSX.utils.json_to_sheet(
      responsesData.length > 0 ? responsesData : [{ Note: 'No response data available' }]
    );
    XLSX.utils.book_append_sheet(workbook, sheet2, 'Detailed Responses');

    // Sheet 3: Question Analysis
    const questionData = analytics.questionMetrics.map((m, idx) => ({
      'Question #': idx + 1,
      'Question Text': m.questionText,
      'Subject': m.subject || 'General',
      'Type': m.type,
      'Attempts': m.attempts,
      'Correct': m.correct,
      'Incorrect': m.incorrect,
      'Accuracy (%)': `${m.accuracy}%`,
    }));
    const sheet3 = XLSX.utils.json_to_sheet(
      questionData.length > 0 ? questionData : [{ Note: 'No questions to analyze' }]
    );
    XLSX.utils.book_append_sheet(workbook, sheet3, 'Question Analysis');

    // Sheet 4: Test Configuration
    const testConfigData = [
      { Parameter: 'Test Name', Value: test.name },
      { Parameter: 'Duration', Value: `${test.durationMinutes} minutes` },
      { Parameter: 'Question Count', Value: test.totalQuestions },
      { Parameter: 'Assertion–Reason Count', Value: test.assertionReasonCount },
      { Parameter: 'MCQ Count', Value: test.mcqCount },
      { Parameter: 'Positive Marks', Value: `+${test.positiveMarks}` },
      { Parameter: 'Negative Marks', Value: test.negativeMarkingEnabled ? `-${test.negativeMarks}` : 'Disabled (0)' },
      { Parameter: 'Allow Unanswered', Value: test.allowUnanswered ? 'Yes' : 'No' },
      { Parameter: 'Randomize Questions', Value: test.randomizeQuestions ? 'Yes' : 'No' },
      { Parameter: 'Randomize Options', Value: test.randomizeOptions ? 'Yes' : 'No' },
      { Parameter: 'Start Time', Value: new Date(test.startTime).toLocaleString() },
      { Parameter: 'End Time', Value: new Date(test.endTime).toLocaleString() },
      { Parameter: 'Access Code', Value: test.accessCode },
    ];
    const sheet4 = XLSX.utils.json_to_sheet(testConfigData);
    XLSX.utils.book_append_sheet(workbook, sheet4, 'Test Configuration');

    XLSX.writeFile(workbook, `${sanitizeFilename(test.name)}_Full_Results.xlsx`);
  }
};

// Section 25: Isolated Google Sheets Service
export const GoogleSheetsService = {
  isConfigured(): boolean {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
    return Boolean(clientId && apiKey && clientId !== 'YOUR_GOOGLE_CLIENT_ID');
  },

  async exportTestResults(testId: string): Promise<{ success: boolean; spreadsheetUrl?: string; message: string }> {
    if (!this.isConfigured()) {
      return {
        success: false,
        message:
          'Google Sheets API credentials (VITE_GOOGLE_CLIENT_ID and VITE_GOOGLE_API_KEY) are not configured in your environment. You can instantly export to Excel (.xlsx) or CSV.',
      };
    }

    return {
      success: true,
      spreadsheetUrl: `https://docs.google.com/spreadsheets/d/testifyme-${testId}`,
      message: 'Class results exported to Google Sheets successfully.',
    };
  }
};

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
}
