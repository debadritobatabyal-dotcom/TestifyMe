export type Role = 'student' | 'teacher';

export interface User {
  id: string; // Firebase UID
  email: string;
  name: string;
  role: Role;
  studentId?: string; // Roll number / Student ID (for students)
  phoneNumber?: string;
  passwordHash?: string;
  createdAt: number;
  schoolName?: string; // Teacher institution/school
  department?: string; // Teacher department
  title?: string; // e.g. "Senior Physics Faculty"
}

export type QuestionType = 'MCQ' | 'ASSERTION_REASON';
export type DifficultyLevel = 'easy' | 'medium' | 'hard';

export interface Question {
  id: string;
  ownerId?: string; // Authenticated Teacher UID ownership (Requirements 2, 4, 14)
  type: QuestionType;
  questionText: string;
  assertion?: string;
  reason?: string;
  options: {
    id: string; // 'A' | 'B' | 'C' | 'D'
    text: string;
  }[];
  correctAnswer: string; // 'A' | 'B' | 'C' | 'D' - protected server-side
  marks: number;
  explanation?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty: DifficultyLevel;
  active: boolean;
  createdAt: number;
}

// Student-safe question format (strips correctAnswer & explanation)
export interface StudentSafeQuestion {
  id: string;
  type: QuestionType;
  questionText: string;
  assertion?: string;
  reason?: string;
  options: {
    id: string;
    text: string;
  }[];
  marks: number;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty: DifficultyLevel;
}

export type TestStatus = 'draft' | 'scheduled' | 'active' | 'closed';

export interface Test {
  id: string;
  ownerId?: string; // Authenticated Teacher UID (Requirements 2, 3, 4, 9, 13)
  name: string;
  description: string;
  durationMinutes: number; // e.g. 40
  startTime: number; // timestamp in ms
  endTime: number; // timestamp in ms
  totalQuestions: number; // default 40
  assertionReasonCount: number; // default 5
  mcqCount: number; // default 35
  positiveMarks: number; // e.g. +1 or +4
  marksPerQuestion?: number; // alias
  negativeMarkingEnabled: boolean;
  negativeMarks: number; // e.g. 0.25 or 1.0 (subtracted on incorrect)
  negativeMarking?: number; // alias
  allowUnanswered: boolean;
  randomizeQuestions: boolean;
  randomizeOptions: boolean;
  maxAttempts: number; // default 1
  accessCode: string; // e.g. 'CHEM-7X92'
  testCode?: string; // Standard public access identifier e.g. 'CLAS-FM5D'
  isPublished?: boolean;
  status: TestStatus;
  createdBy: string; // matches ownerId
  createdAt: number;
  questions?: StudentSafeQuestion[]; // Student-safe questions package attached to test
  answerKeys?: Record<string, string>; // questionId -> correctAnswer for scoring evaluation
  explanations?: Record<string, string>; // questionId -> explanation
}

// Safe Public Test Metadata (Exposed for student link resolution without leaking questions/answers)
export interface PublicTestAccess {
  testId: string;
  testCode: string;
  accessCode: string;
  name: string;
  title?: string;
  description: string;
  durationMinutes: number;
  startTime: number;
  endTime: number;
  totalQuestions: number;
  assertionReasonCount: number;
  mcqCount: number;
  positiveMarks: number;
  negativeMarkingEnabled: boolean;
  negativeMarks: number;
  negativeMarking?: number;
  status: TestStatus;
  isPublished: boolean;
  ownerId: string;
  createdAt: number;
}

export type AttemptStatus = 'in_progress' | 'submitted' | 'timed_out';

export interface StudentAnswer {
  questionId: string;
  selectedOptionId: string | null; // 'A', 'B', 'C', 'D' or null
  isMarkedForReview: boolean;
  savedAt: number;
}

export interface TestAttempt {
  id: string;
  testId: string;
  ownerId?: string; // Teacher UID who owns the test
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRollNumber?: string;
  questionIds: string[]; // randomized set of question IDs
  questions: StudentSafeQuestion[];
  answers: Record<string, StudentAnswer>;
  score?: number;
  maxScore?: number;
  correctCount?: number;
  incorrectCount?: number;
  unansweredCount?: number;
  percentage?: number;
  startedAt: number;
  expiresAt: number; // server-authoritative end timestamp
  submittedAt?: number;
  status: AttemptStatus;
}

export interface DetailedStudentResponse {
  questionId: string;
  questionText: string;
  type: QuestionType;
  assertion?: string;
  reason?: string;
  options: { id: string; text: string }[];
  selectedOptionId: string | null;
  studentAnswer?: string;
  correctAnswer: string;
  isCorrect: boolean;
  isUnanswered: boolean;
  marksAwarded: number;
  explanation?: string;
}

export interface StudentAttemptSummary {
  attemptId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  studentRollNumber?: string;
  testId: string;
  attemptedCount: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: number;
  status: AttemptStatus;
  responses?: DetailedStudentResponse[];
}

export interface QuestionAccuracyMetric {
  questionId: string;
  questionText: string;
  type: QuestionType;
  subject?: string;
  attempts: number;
  correct: number;
  incorrect: number;
  unanswered: number;
  accuracy: number; // percentage (0 - 100)
}

export interface ClassAnalytics {
  totalStudents: number;
  totalSubmissions: number;
  averageScore: number;
  highestScore: number;
  lowestScore: number;
  medianScore: number;
  averagePercentage: number;
  questionMetrics: QuestionAccuracyMetric[];
}

export interface ImportValidationResult {
  totalRows: number;
  validQuestions: Question[];
  invalidRows: { rowNumber: number; reason: string; raw: any }[];
  duplicateCount: number;
  missingAnswersCount: number;
}

// Staging & Review Models for Multi-Source Question Import
export interface ImportedQuestionCandidate {
  id: string;
  questionText: string;
  type: QuestionType;
  assertion?: string;
  reason?: string;
  options: { id: string; text: string }[];
  correctAnswer: string; // 'A' | 'B' | 'C' | 'D' or empty if needs review
  marks: number;
  explanation?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty: DifficultyLevel;
  isValid: boolean;
  validationMessage?: string;
  sourceRaw?: string;
}

export interface ParseReport {
  importedCount: number;
  validCount: number;
  needsReviewCount: number;
  duplicateCount: number;
  candidates: ImportedQuestionCandidate[];
}
