import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, safeStorage } from '../src/services/storage';
import { AuthService } from '../src/services/authService';
import { TestService } from '../src/services/testService';
import { ExamService } from '../src/services/examService';
import { AnalyticsService } from '../src/services/analyticsService';
import { Question, User, TestAttempt } from '../src/types';

describe('Teacher Portal Real-Time Synchronization & Submission Verification', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('verifies submission persistence, score calculation, teacher visibility, and real-time updates', async () => {
    // 1. Setup Teacher A
    const teacherAReg = await AuthService.registerTeacher({
      name: 'Professor Liam Vance',
      email: 'liam.vance@physics.edu',
      password: 'ProfPassword123!',
      schoolName: 'MIT Physics',
      department: 'Astrophysics',
    });
    const teacherA: User = teacherAReg.user!;

    // 2. Setup Teacher B (for multi-teacher isolation verification)
    const teacherBReg = await AuthService.registerTeacher({
      name: 'Dr. Clara Oswald',
      email: 'clara.oswald@math.edu',
      password: 'ClaraPassword123!',
      schoolName: 'London Maths Institute',
    });
    const teacherB: User = teacherBReg.user!;

    // 3. Create questions for Teacher A
    const questions: Question[] = [];
    for (let i = 1; i <= 35; i++) {
      questions.push({
        id: `q-mcq-${i}`,
        ownerId: teacherA.id,
        type: 'MCQ',
        questionText: `Physics MCQ ${i}`,
        options: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' },
        ],
        correctAnswer: 'A',
        marks: 2,
        subject: 'Physics',
        difficulty: 'medium',
        active: true,
        createdAt: Date.now(),
      });
    }
    for (let i = 1; i <= 5; i++) {
      questions.push({
        id: `q-ar-${i}`,
        ownerId: teacherA.id,
        type: 'ASSERTION_REASON',
        questionText: `Physics AR ${i}`,
        assertion: `Assertion ${i}`,
        reason: `Reason ${i}`,
        options: [
          { id: 'A', text: 'Both true, correct explanation' },
          { id: 'B', text: 'Both true, not correct explanation' },
          { id: 'C', text: 'Assertion true, reason false' },
          { id: 'D', text: 'Both false' },
        ],
        correctAnswer: 'A',
        marks: 2,
        subject: 'Physics',
        difficulty: 'hard',
        active: true,
        createdAt: Date.now(),
      });
    }
    Storage.addQuestionsBulk(questions, teacherA.id);

    // 4. Teacher A creates an active test:
    // 40 questions, positive mark = 2, negative marking = 0.5 (25% penalty)
    const now = Date.now();
    const testRes = TestService.createTest({
      name: 'Classical Mechanics & Waves Examination',
      description: 'Timed final assessment',
      durationMinutes: 60,
      startTime: now - 60000,
      endTime: now + 3600000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 2,
      negativeMarkingEnabled: true,
      negativeMarks: 0.5,
      accessCode: 'PHYS-LIVE',
      createdBy: teacherA.id,
      ownerId: teacherA.id,
    });
    const testA = testRes.test!;

    // =========================================================================
    // SECTION 6, 7, 8: Real-Time Listener Initialization on Teacher Results View
    // =========================================================================
    let liveAttemptsReceived: TestAttempt[] = [];
    const unsubscribeTeacherA = ExamService.subscribeToTeacherAttempts(
      teacherA.id,
      testA.id,
      updatedAttempts => {
        liveAttemptsReceived = updatedAttempts;
      }
    );

    // Initially, no students have attempted the test
    expect(liveAttemptsReceived.length).toBe(0);

    // =========================================================================
    // SECTION 15: Live Status Before Submission (In Progress)
    // =========================================================================
    // Student 1 starts test
    const student1Reg = await AuthService.registerStudent({
      name: 'Rohan Gupta',
      studentId: 'ROLL-101',
      email: 'rohan.gupta@student.edu',
      password: 'StudentPassword123!',
    });
    const student1 = student1Reg.user!;

    const attempt1Res = ExamService.startOrResumeAttempt(testA.id, student1);
    const attempt1 = attempt1Res.attempt!;
    expect(attempt1.status).toBe('in_progress');

    // Verify teacher listener receives the in-progress attempt
    expect(liveAttemptsReceived.length).toBe(1);
    expect(liveAttemptsReceived[0].status).toBe('in_progress');
    expect(liveAttemptsReceived[0].studentName).toBe('Rohan Gupta');

    // Summaries check live status
    const liveSummariesBeforeSubmit = ExamService.getTestAttemptSummaries(testA.id, teacherA.id, liveAttemptsReceived);
    expect(liveSummariesBeforeSubmit.length).toBe(1);
    expect(liveSummariesBeforeSubmit[0].status).toBe('in_progress');

    // =========================================================================
    // SECTION 2, 3, 16: Authoritative Server-Side Scoring & Submission
    // =========================================================================
    // Student 1 answers:
    // 5 questions correct (+2 each = +10)
    // 2 questions wrong (-0.5 each = -1.0)
    // 33 unanswered (0)
    // Expected score: 10 - 1 = 9
    for (let i = 0; i < 5; i++) {
      ExamService.saveAnswer(attempt1.id, attempt1.questionIds[i], 'A', false);
    }
    for (let i = 5; i < 7; i++) {
      ExamService.saveAnswer(attempt1.id, attempt1.questionIds[i], 'B', false); // 'B' is wrong
    }

    const submitted1 = ExamService.submitAttempt(attempt1.id);
    expect(submitted1.status).toBe('submitted');
    expect(submitted1.score).toBe(9);
    expect(submitted1.maxScore).toBe(80); // 40 * 2
    expect(submitted1.percentage).toBe(11.3); // 9 / 80 * 100 = 11.25 -> 11.3%
    expect(submitted1.correctCount).toBe(5);
    expect(submitted1.incorrectCount).toBe(2);
    expect(submitted1.unansweredCount).toBe(33);

    // =========================================================================
    // SECTION 4: Submission Persistence
    // =========================================================================
    const storedAttempt1 = Storage.getAttemptById(attempt1.id);
    expect(storedAttempt1).toBeDefined();
    expect(storedAttempt1?.status).toBe('submitted');
    expect(storedAttempt1?.score).toBe(9);
    expect(storedAttempt1?.submittedAt).toBeDefined();

    // =========================================================================
    // SECTION 7 & 14: Teacher Portal Real-time Results Update
    // =========================================================================
    expect(liveAttemptsReceived.length).toBe(1);
    expect(liveAttemptsReceived[0].status).toBe('submitted');
    expect(liveAttemptsReceived[0].score).toBe(9);

    const liveSummariesAfterSubmit = ExamService.getTestAttemptSummaries(testA.id, teacherA.id, liveAttemptsReceived);
    expect(liveSummariesAfterSubmit.length).toBe(1);
    expect(liveSummariesAfterSubmit[0].status).toBe('submitted');
    expect(liveSummariesAfterSubmit[0].score).toBe(9);
    expect(liveSummariesAfterSubmit[0].studentName).toBe('Rohan Gupta');

    // =========================================================================
    // SECTION 20: Duplicate Submission Idempotency
    // =========================================================================
    const duplicateSubmit = ExamService.submitAttempt(attempt1.id);
    expect(duplicateSubmit.status).toBe('submitted');
    expect(duplicateSubmit.score).toBe(9);
    // Should still be exactly 1 submission in storage
    const allAttemptsForTest = Storage.getAttempts(testA.id);
    expect(allAttemptsForTest.length).toBe(1);

    // =========================================================================
    // SECTION 18: Concurrent Submissions from Multiple Students
    // =========================================================================
    // Student 2: Ananya
    const student2Reg = await AuthService.registerStudent({
      name: 'Ananya Sen',
      studentId: 'ROLL-102',
      email: 'ananya.sen@student.edu',
      password: 'StudentPassword123!',
    });
    const student2 = student2Reg.user!;
    const attempt2 = ExamService.startOrResumeAttempt(testA.id, student2).attempt!;
    // Answers 10 questions correct (+20)
    for (let i = 0; i < 10; i++) {
      ExamService.saveAnswer(attempt2.id, attempt2.questionIds[i], 'A', false);
    }
    const submitted2 = ExamService.submitAttempt(attempt2.id);
    expect(submitted2.score).toBe(20);

    // Student 3: Kabir
    const student3Reg = await AuthService.registerStudent({
      name: 'Kabir Mehta',
      studentId: 'ROLL-103',
      email: 'kabir.mehta@student.edu',
      password: 'StudentPassword123!',
    });
    const student3 = student3Reg.user!;
    const attempt3 = ExamService.startOrResumeAttempt(testA.id, student3).attempt!;
    // Answers 20 questions correct (+40)
    for (let i = 0; i < 20; i++) {
      ExamService.saveAnswer(attempt3.id, attempt3.questionIds[i], 'A', false);
    }
    const submitted3 = ExamService.submitAttempt(attempt3.id);
    expect(submitted3.score).toBe(40);

    // Verify all 3 submissions are retained and present in teacher listener
    expect(liveAttemptsReceived.length).toBe(3);
    const studentNamesInResults = liveAttemptsReceived.map(a => a.studentName);
    expect(studentNamesInResults).toContain('Rohan Gupta');
    expect(studentNamesInResults).toContain('Ananya Sen');
    expect(studentNamesInResults).toContain('Kabir Mehta');

    // =========================================================================
    // SECTION 13 & 17: Live Analytics Calculation
    // =========================================================================
    const liveAnalytics = AnalyticsService.getClassAnalytics(testA.id, teacherA.id, liveAttemptsReceived);
    expect(liveAnalytics.totalSubmissions).toBe(3);
    // Average score: (9 + 20 + 40) / 3 = 69 / 3 = 23
    expect(liveAnalytics.averageScore).toBe(23);
    expect(liveAnalytics.highestScore).toBe(40);
    expect(liveAnalytics.lowestScore).toBe(9);
    expect(liveAnalytics.medianScore).toBe(20);
    expect(liveAnalytics.questionMetrics.length).toBeGreaterThan(0);

    // =========================================================================
    // SECTION 21: Teacher Dashboard Counters Live Update
    // =========================================================================
    const dashboardStats = AnalyticsService.getTeacherOverviewAnalytics(teacherA.id, liveAttemptsReceived);
    expect(dashboardStats.totalSubmissions).toBe(3);
    expect(dashboardStats.participatingStudents).toBe(3);
    expect(dashboardStats.activeTests).toBe(1);

    // =========================================================================
    // SECTION 5, 10: Multi-Teacher Isolation
    // =========================================================================
    // Teacher B attempts query for testA
    const teacherBAttempts = Storage.getAttempts(testA.id, teacherB.id);
    expect(teacherBAttempts.length).toBe(0);

    const teacherBOverview = AnalyticsService.getTeacherOverviewAnalytics(teacherB.id);
    expect(teacherBOverview.totalSubmissions).toBe(0);
    expect(teacherBOverview.participatingStudents).toBe(0);

    // Clean up subscription
    unsubscribeTeacherA();
  });
});
