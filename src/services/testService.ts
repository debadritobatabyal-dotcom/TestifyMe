import { Test, TestStatus, StudentSafeQuestion } from '../types';
import { Storage } from './storage';
import { QuestionService } from './questionService';

export interface TestAvailabilityResult {
  status: 'not_started' | 'active' | 'closed';
  isAvailable: boolean;
  message: string;
  startsInMs: number;
  endsInMs: number;
}

export const TestService = {
  getAllTests(teacherId?: string): Test[] {
    const tests = Storage.getTests(teacherId);
    // Update statuses based on current server-authoritative time
    const now = Date.now();
    return tests.map(test => {
      let status: TestStatus = test.status;
      if (test.status !== 'draft') {
        if (now < test.startTime) {
          status = 'scheduled';
        } else if (now >= test.startTime && now <= test.endTime) {
          status = 'active';
        } else {
          status = 'closed';
        }
      }
      return { ...test, status };
    });
  },

  getTestsForTeacher(teacherId: string): Test[] {
    return this.getAllTests(teacherId);
  },

  getTestById(id: string, teacherId?: string): Test | undefined {
    return Storage.getTestById(id, teacherId);
  },

  getAuthorizedTestById(id: string, teacherId: string): { test?: Test; error?: string } {
    return Storage.getAuthorizedTestById(id, teacherId);
  },

  getTestByAccessCode(code: string): Test | undefined {
    return Storage.getTestByAccessCode(code);
  },

  async resolveTestByCode(code: string): Promise<{ test?: Test; error?: string }> {
    const clean = (code || '').trim().toUpperCase();
    if (!clean) {
      return { error: 'Please enter a test access code.' };
    }
    const test = await Storage.resolveTestByCode(clean);
    if (!test) {
      return { error: `No examination found matching test code "${clean}". Please check with your teacher.` };
    }
    return { test };
  },

  generateAccessCode(prefix: string = 'TEST'): string {
    return this.generateUniqueTestCode(prefix);
  },

  // Unique Test Code Generation (Requirement 13)
  generateUniqueTestCode(prefix: string = 'TEST'): string {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const cleanPrefix = (prefix.split(' ')[0] || 'TEST')
      .replace(/[^a-zA-Z]/g, '')
      .substring(0, 4)
      .toUpperCase() || 'EXAM';

    const existingCodes = new Set(
      Storage.getTests().map(t => (t.testCode || t.accessCode || '').toUpperCase())
    );

    let attempts = 0;
    while (attempts < 50) {
      let randomPart = '';
      for (let i = 0; i < 4; i++) {
        randomPart += letters.charAt(Math.floor(Math.random() * letters.length));
      }
      const candidate = `${cleanPrefix}-${randomPart}`;
      if (!existingCodes.has(candidate)) {
        return candidate;
      }
      attempts++;
    }

    return `${cleanPrefix}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  },

  // Exact Availability Validation (Requirement 8)
  getTestAvailability(test: Test, referenceTimeMs: number = Date.now()): TestAvailabilityResult {
    const now = referenceTimeMs;
    const startsInMs = Math.max(0, test.startTime - now);
    const endsInMs = Math.max(0, test.endTime - now);

    // 1. Unpublished / Draft check
    if (test.status === 'draft' || test.isPublished === false) {
      return {
        status: 'not_started',
        isAvailable: false,
        message: 'This test is not currently available.',
        startsInMs: 0,
        endsInMs: 0,
      };
    }

    // 2. Scheduled for later check
    if (now < test.startTime) {
      return {
        status: 'not_started',
        isAvailable: false,
        message: `This test starts on ${new Date(test.startTime).toLocaleString()}.`,
        startsInMs,
        endsInMs,
      };
    }

    // 3. Expired / Window closed check
    if (now > test.endTime) {
      return {
        status: 'closed',
        isAvailable: false,
        message: 'This test is no longer available.',
        startsInMs: 0,
        endsInMs: 0,
      };
    }

    // 4. Currently active
    return {
      status: 'active',
      isAvailable: true,
      message: 'Test available',
      startsInMs: 0,
      endsInMs,
    };
  },

  createTest(params: {
    name: string;
    description: string;
    durationMinutes: number;
    startTime: number;
    endTime: number;
    totalQuestions?: number;
    assertionReasonCount?: number;
    mcqCount?: number;
    positiveMarks?: number;
    marksPerQuestion?: number;
    negativeMarkingEnabled?: boolean;
    negativeMarks?: number;
    negativeMarking?: number;
    allowUnanswered?: boolean;
    randomizeQuestions?: boolean;
    randomizeOptions?: boolean;
    maxAttempts?: number;
    accessCode?: string;
    createdBy: string;
    ownerId?: string;
  }): { test?: Test; error?: string } {
    const ownerId = params.ownerId || params.createdBy;

    // Validate question bank availability for this specific teacher
    const activeQuestions = QuestionService.getActiveQuestions(ownerId);
    const arQuestions = activeQuestions.filter(q => q.type === 'ASSERTION_REASON');
    const mcqQuestions = activeQuestions.filter(q => q.type === 'MCQ');

    const totalQuestions = params.totalQuestions ?? 40;
    const arCount = params.assertionReasonCount ?? 5;
    const mcqCount = params.mcqCount ?? 35;

    if (totalQuestions !== arCount + mcqCount) {
      return { error: `Total questions (${totalQuestions}) must equal Assertion-Reason (${arCount}) + MCQ (${mcqCount}).` };
    }

    if (arQuestions.length < arCount) {
      return {
        error: `Insufficient Assertion-Reason questions in your question bank. Required: ${arCount}, Available: ${arQuestions.length}. Please import or add more questions first.`,
      };
    }

    if (mcqQuestions.length < mcqCount) {
      return {
        error: `Insufficient MCQ questions in your question bank. Required: ${mcqCount}, Available: ${mcqQuestions.length}. Please import or add more questions first.`,
      };
    }

    if (params.startTime >= params.endTime) {
      return { error: 'End time must be after start time.' };
    }

    if (params.durationMinutes < 1) {
      return { error: 'Test duration must be at least 1 minute.' };
    }

    const testId = `test-${Date.now().toString(36)}`;
    const accessCode = params.accessCode?.trim().toUpperCase() || this.generateAccessCode(params.name);

    const now = Date.now();
    let initialStatus: TestStatus = 'scheduled';
    if (now >= params.startTime && now <= params.endTime) {
      initialStatus = 'active';
    } else if (now > params.endTime) {
      initialStatus = 'closed';
    }

    const positiveMarks = params.positiveMarks ?? params.marksPerQuestion ?? 1;
    const negativeMarks = params.negativeMarks ?? params.negativeMarking ?? 0.25;
    const negativeMarkingEnabled =
      params.negativeMarkingEnabled !== undefined
        ? params.negativeMarkingEnabled
        : (params.negativeMarking !== undefined ? params.negativeMarking > 0 : true);

    const shuffledAR = [...arQuestions].sort(() => Math.random() - 0.5);
    const shuffledMCQ = [...mcqQuestions].sort(() => Math.random() - 0.5);
    const selectedAR = shuffledAR.slice(0, Math.min(arCount, arQuestions.length));
    const selectedMCQ = shuffledMCQ.slice(0, Math.min(mcqCount, mcqQuestions.length));
    const combinedQuestions = [...selectedAR, ...selectedMCQ];

    const safeQuestions: StudentSafeQuestion[] = combinedQuestions.map(q => ({
      id: q.id,
      type: q.type,
      questionText: q.questionText,
      assertion: q.assertion,
      reason: q.reason,
      options: q.options.map(opt => ({ id: opt.id, text: opt.text })),
      marks: positiveMarks,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
    }));

    const answerKeys: Record<string, string> = {};
    const explanations: Record<string, string> = {};
    combinedQuestions.forEach(q => {
      answerKeys[q.id] = q.correctAnswer;
      if (q.explanation) explanations[q.id] = q.explanation;
    });

    const newTest: Test = {
      id: testId,
      ownerId,
      name: params.name.trim(),
      description: params.description.trim(),
      durationMinutes: params.durationMinutes,
      startTime: params.startTime,
      endTime: params.endTime,
      totalQuestions,
      assertionReasonCount: arCount,
      mcqCount,
      positiveMarks,
      marksPerQuestion: positiveMarks,
      negativeMarkingEnabled,
      negativeMarks,
      negativeMarking: negativeMarkingEnabled ? negativeMarks : 0,
      allowUnanswered: params.allowUnanswered ?? true,
      randomizeQuestions: params.randomizeQuestions ?? true,
      randomizeOptions: params.randomizeOptions ?? true,
      maxAttempts: params.maxAttempts ?? 1,
      accessCode,
      testCode: accessCode,
      status: initialStatus,
      isPublished: true,
      createdBy: ownerId,
      createdAt: now,
      questions: safeQuestions,
      answerKeys,
      explanations,
    };

    Storage.saveTest(newTest, ownerId);
    return { test: newTest };
  },

  updateTest(test: Test, teacherId?: string): Test {
    return Storage.saveTest(test, teacherId);
  },

  deleteTest(id: string, teacherId?: string): boolean {
    return Storage.deleteTest(id, teacherId);
  },

  duplicateTest(testId: string, createdBy: string): Test | undefined {
    const original = Storage.getTestById(testId);
    if (!original) return undefined;

    const copy: Test = {
      ...original,
      id: `test-${Date.now().toString(36)}`,
      name: `${original.name} (Copy)`,
      accessCode: this.generateAccessCode(original.name),
      startTime: Date.now() + 60 * 60 * 1000,
      endTime: Date.now() + 25 * 60 * 60 * 1000,
      status: 'scheduled',
      createdBy,
      createdAt: Date.now(),
    };

    Storage.saveTest(copy);
    return copy;
  }
};
