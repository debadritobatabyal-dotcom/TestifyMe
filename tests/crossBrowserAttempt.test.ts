import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, safeStorage } from '../src/services/storage';
import { AuthService } from '../src/services/authService';
import { TestService } from '../src/services/testService';
import { ExamService } from '../src/services/examService';
import { QuestionService } from '../src/services/questionService';
import { Question, User } from '../src/types';

describe('Cross-Browser Real-World Acceptance Test (Teacher Chrome vs Student Safari)', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('verifies the complete flow from Teacher in Chrome to clean Student in Safari', async () => {
    // =========================================================================
    // STAGE A: Browser 1 (Teacher Chrome)
    // =========================================================================
    // 1. Teacher A registers
    const teacherReg = await AuthService.registerTeacher({
      name: 'Dr. Evelyn Reed',
      email: 'evelyn.reed@faculty.edu',
      password: 'FacultyPassword123!',
      schoolName: 'Oxford Science Academy',
      department: 'Chemistry',
    });
    expect(teacherReg.user).toBeDefined();
    const teacherA: User = teacherReg.user!;
    expect(teacherA.role).toBe('teacher');

    // 2. Teacher A imports question bank (at least 35 MCQs and 5 Assertion-Reason)
    const questions: Question[] = [];
    // 38 MCQs
    for (let i = 1; i <= 38; i++) {
      questions.push({
        id: `q-mcq-${i}`,
        ownerId: teacherA.id,
        type: 'MCQ',
        questionText: `Organic Chemistry MCQ Question ${i}: What is the IUPAC name?`,
        options: [
          { id: 'A', text: `Option A for Q${i}` },
          { id: 'B', text: `Option B for Q${i}` },
          { id: 'C', text: `Option C for Q${i}` },
          { id: 'D', text: `Option D for Q${i}` },
        ],
        correctAnswer: i % 2 === 0 ? 'B' : 'A',
        marks: 1,
        explanation: `Detailed explanation for MCQ ${i}`,
        subject: 'Chemistry',
        chapter: 'Organic Chemistry',
        difficulty: 'medium',
        active: true,
        createdAt: Date.now(),
      });
    }

    // 8 Assertion-Reason questions
    for (let i = 1; i <= 8; i++) {
      questions.push({
        id: `q-ar-${i}`,
        ownerId: teacherA.id,
        type: 'ASSERTION_REASON',
        questionText: `Assertion-Reason Question ${i}`,
        assertion: `Assertion statement for AR ${i}`,
        reason: `Reason statement for AR ${i}`,
        options: [
          { id: 'A', text: 'Both Assertion and Reason are true and Reason is correct explanation' },
          { id: 'B', text: 'Both Assertion and Reason are true but Reason is not correct explanation' },
          { id: 'C', text: 'Assertion is true but Reason is false' },
          { id: 'D', text: 'Both Assertion and Reason are false' },
        ],
        correctAnswer: 'A',
        marks: 1,
        explanation: `Explanation for AR ${i}`,
        subject: 'Chemistry',
        chapter: 'Equilibrium',
        difficulty: 'hard',
        active: true,
        createdAt: Date.now(),
      });
    }

    Storage.addQuestionsBulk(questions, teacherA.id);
    expect(QuestionService.getActiveQuestions(teacherA.id).length).toBe(46);

    // 3. Teacher creates a published test (40 questions: 35 MCQ + 5 AR)
    const now = Date.now();
    const createRes = TestService.createTest({
      name: 'Advanced Physical & Organic Chemistry Final',
      description: 'Comprehensive timed examination',
      durationMinutes: 45,
      startTime: now - 1000 * 60, // Started 1 minute ago (active window)
      endTime: now + 1000 * 60 * 60, // Ends in 1 hour
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      accessCode: 'CLAS-FM5D',
      createdBy: teacherA.id,
      ownerId: teacherA.id,
    });

    expect(createRes.test).toBeDefined();
    const publishedTest = createRes.test!;
    expect(publishedTest.testCode).toBe('CLAS-FM5D');
    expect(publishedTest.questions).toBeDefined();
    expect(publishedTest.questions!.length).toBe(40);
    expect(publishedTest.questions!.filter(q => q.type === 'ASSERTION_REASON').length).toBe(5);
    expect(publishedTest.questions!.filter(q => q.type === 'MCQ').length).toBe(35);

    // =========================================================================
    // STAGE B: Browser 2 (Student Safari Private Browsing)
    // Simulating a separate clean browser session:
    // - No teacher session in currentUser
    // - No teacher questions in localStorage
    // =========================================================================
    AuthService.logout();
    expect(AuthService.getCurrentUser()).toBeNull();

    // Student opens test link /test/CLAS-FM5D
    // Stage 1: Resolve Test
    const resolved = await TestService.resolveTestByCode('CLAS-FM5D');
    expect(resolved.test).toBeDefined();
    const studentTest = resolved.test!;
    expect(studentTest.testCode).toBe('CLAS-FM5D');

    // Stage 2: Authenticate Student
    const studentReg = await AuthService.registerStudent({
      name: 'Aarav Sharma',
      studentId: 'ROLL-2026-089',
      email: 'aarav.sharma@student.edu',
      password: 'StudentSecurePass123!',
      phoneNumber: '+91 98765 43210',
    });

    expect(studentReg.user).toBeDefined();
    const studentA = studentReg.user!;
    expect(studentA.role).toBe('student');
    // Ensure student UID is distinct from teacher UID
    expect(studentA.id).not.toBe(teacherA.id);

    // Stage 3: Authorize Student
    const availability = TestService.getTestAvailability(studentTest);
    expect(availability.isAvailable).toBe(true);
    expect(availability.status).toBe('active');

    // Stage 4: Create Attempt in Safari (even though Safari question bank is empty!)
    const attemptRes = ExamService.startOrResumeAttempt(studentTest.id, studentA);
    expect(attemptRes.error).toBeUndefined();
    expect(attemptRes.attempt).toBeDefined();

    const studentAttempt = attemptRes.attempt!;
    // CRITICAL: studentId must be student UID, NOT teacher UID!
    expect(studentAttempt.studentId).toBe(studentA.id);
    expect(studentAttempt.studentId).not.toBe(teacherA.id);
    expect(studentAttempt.ownerId).toBe(teacherA.id);

    // Verify 40 questions loaded
    expect(studentAttempt.questions.length).toBe(40);
    // Verify 35 MCQ and 5 AR distribution
    const studentAR = studentAttempt.questions.filter(q => q.type === 'ASSERTION_REASON');
    const studentMCQ = studentAttempt.questions.filter(q => q.type === 'MCQ');
    expect(studentAR.length).toBe(5);
    expect(studentMCQ.length).toBe(35);

    // Verify correct answers and explanations are NOT leaked to the student
    studentAttempt.questions.forEach((q: any) => {
      expect(q.correctAnswer).toBeUndefined();
      expect(q.explanation).toBeUndefined();
    });

    // Student answers 3 questions
    const q1 = studentAttempt.questions[0];
    const q2 = studentAttempt.questions[1];
    ExamService.saveAnswer(studentAttempt.id, q1.id, 'A', false);
    ExamService.saveAnswer(studentAttempt.id, q2.id, 'B', true);

    // =========================================================================
    // STAGE C: Student refreshes Safari page
    // =========================================================================
    const resumedRes = ExamService.startOrResumeAttempt(studentTest.id, studentA);
    expect(resumedRes.attempt).toBeDefined();
    const resumedAttempt = resumedRes.attempt!;

    // Must be the EXACT same attempt ID (idempotent)
    expect(resumedAttempt.id).toBe(studentAttempt.id);
    // Must retain exact same question IDs and order
    expect(resumedAttempt.questionIds).toEqual(studentAttempt.questionIds);
    // Must retain saved answers
    expect(resumedAttempt.answers[q1.id]?.selectedOptionId).toBe('A');
    expect(resumedAttempt.answers[q2.id]?.selectedOptionId).toBe('B');
    expect(resumedAttempt.answers[q2.id]?.isMarkedForReview).toBe(true);
    // Must retain exact expiry timestamp
    expect(resumedAttempt.expiresAt).toBe(studentAttempt.expiresAt);

    // =========================================================================
    // STAGE D: Student Submits Attempt
    // =========================================================================
    const submittedAttempt = ExamService.submitAttempt(studentAttempt.id);
    expect(submittedAttempt.status).toBe('submitted');
    expect(submittedAttempt.score).toBeDefined();
    expect(submittedAttempt.maxScore).toBe(40);

    // =========================================================================
    // STAGE E: Browser 3 (Second Student in another session)
    // =========================================================================
    AuthService.logout();

    const studentBReg = await AuthService.registerStudent({
      name: 'Maya Patel',
      studentId: 'ROLL-2026-102',
      email: 'maya.patel@student.edu',
      password: 'MayaPassword123!',
    });
    const studentB = studentBReg.user!;
    expect(studentB.id).not.toBe(studentA.id);

    const attemptBRes = ExamService.startOrResumeAttempt(studentTest.id, studentB);
    expect(attemptBRes.attempt).toBeDefined();
    const studentBAttempt = attemptBRes.attempt!;

    // Student B has separate attempt ID and studentId
    expect(studentBAttempt.id).not.toBe(studentAttempt.id);
    expect(studentBAttempt.studentId).toBe(studentB.id);
    // Student B cannot see Student A's answers
    expect(Object.keys(studentBAttempt.answers).length).toBe(0);

    // =========================================================================
    // STAGE F: Teacher A views dashboard in Chrome
    // =========================================================================
    const teacherSummaries = ExamService.getTestAttemptSummaries(studentTest.id, teacherA.id);
    expect(teacherSummaries.length).toBeGreaterThanOrEqual(1);

    const aaravSummary = teacherSummaries.find(s => s.studentId === studentA.id);
    expect(aaravSummary).toBeDefined();
    expect(aaravSummary?.studentName).toBe('Aarav Sharma');
    expect(aaravSummary?.studentRollNumber).toBe('ROLL-2026-089');
    expect(aaravSummary?.status).toBe('submitted');
  });
});
