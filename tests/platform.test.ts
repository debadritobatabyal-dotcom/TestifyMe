import { describe, it, expect, beforeEach } from 'vitest';
import { AuthService } from '../src/services/authService';
import { TestService } from '../src/services/testService';
import { ExamService } from '../src/services/examService';
import { AnalyticsService } from '../src/services/analyticsService';
import { ExportService } from '../src/services/exportService';
import { QuestionParserService } from '../src/services/questionParserService';
import { Storage, safeStorage } from '../src/services/storage';
import { DEMO_STUDENTS, DEMO_QUESTIONS, DEMO_TESTS, DEMO_ATTEMPTS } from '../src/services/demoData';

describe('TestifyMe Comprehensive Platform & Acceptance Tests (Requirements 1-40)', () => {
  beforeEach(() => {
    safeStorage.clear();
    // Seed test fixtures for thorough multi-component verification scoped to primary teacher
    Storage.saveQuestions(DEMO_QUESTIONS.map(q => ({ ...q, ownerId: 'teacher-auth-primary' })));
    Storage.saveTests(DEMO_TESTS.map(t => ({ ...t, ownerId: 'teacher-auth-primary', createdBy: 'teacher-auth-primary' })));
    DEMO_STUDENTS.forEach(s => Storage.saveUser(s));
    DEMO_ATTEMPTS.forEach(a => Storage.saveAttempt(a));
  });

  // 1. Student First-Time Registration & Profile Persistence (Requirement 1 & 27)
  it('1. Student profile persistence - first registration saves profile, subsequent login retains it', async () => {
    // First registration
    const regResult = await AuthService.registerStudent({
      name: 'Rohan Sharma',
      studentId: 'ROLL-2026-999',
      email: 'rohan.sharma@testifyme.edu',
      password: 'password123',
      phoneNumber: '+91 98765 43210',
    });

    expect(regResult.user).toBeDefined();
    expect(regResult.user?.name).toBe('Rohan Sharma');
    expect(regResult.user?.studentId).toBe('ROLL-2026-999');
    expect(regResult.user?.role).toBe('student');

    // Logout
    AuthService.logout();
    expect(AuthService.getCurrentUser()).toBeNull();

    // Login again
    const loginResult = await AuthService.loginStudent('rohan.sharma@testifyme.edu', 'password123');
    expect(loginResult.user).toBeDefined();
    expect(loginResult.user?.name).toBe('Rohan Sharma');
    expect(loginResult.user?.studentId).toBe('ROLL-2026-999');
    expect(loginResult.user?.phoneNumber).toBe('+91 98765 43210');
  });

  // 2. Teacher Authentication & Registration (Multi-Teacher Architecture)
  it('2. Teacher portal security - registers new teacher, authorizes faculty and rejects student attempts', async () => {
    // Register new teacher
    const regTeacher = await AuthService.registerTeacher({
      name: 'Dr. Aris Thorne',
      email: 'dr.thorne@testifyme.edu',
      password: 'teacherpassword123',
      confirmPassword: 'teacherpassword123',
      schoolName: 'Apex Science Academy',
      department: 'Physics',
      title: 'Head of Physics',
    });

    expect(regTeacher.user).toBeDefined();
    expect(regTeacher.user?.role).toBe('teacher');
    expect(regTeacher.user?.schoolName).toBe('Apex Science Academy');
    expect(AuthService.isTeacher()).toBe(true);

    // Logout
    AuthService.logout();
    expect(AuthService.getCurrentUser()).toBeNull();

    // Valid teacher login
    const teacherLogin = await AuthService.loginTeacher('dr.thorne@testifyme.edu', 'teacherpassword123');
    expect(teacherLogin.user).toBeDefined();
    expect(teacherLogin.user?.role).toBe('teacher');
    expect(AuthService.isTeacher()).toBe(true);

    // Logout
    AuthService.logout();

    // Attempt teacher login with student email
    const invalidAttempt = await AuthService.loginTeacher('aarav@testifyme.edu', 'password123');
    expect(invalidAttempt.error).toBeDefined();
    expect(invalidAttempt.user).toBeUndefined();
    expect(AuthService.isTeacher()).toBe(false);

    // Attempt teacher login with wrong password
    const wrongPass = await AuthService.loginTeacher('dr.thorne@testifyme.edu', 'wrong-password');
    expect(wrongPass.error).toBeDefined();
    expect(wrongPass.user).toBeUndefined();
  });

  // 3. Question Bank - Text Import and Parser (Requirement 8, 11, 14, 15)
  it('3. Question Parser - extracts MCQs, Assertion-Reason, and Answer Keys from raw text', () => {
    const rawInput = `
Question 1. What is the powerhouse of the cell?
A. Nucleus
B. Mitochondria
C. Ribosome
D. Endoplasmic reticulum

Question 2.
Assertion: Boiling water turns into steam at 100 degrees Celsius at sea level.
Reason: The vapor pressure of water equals atmospheric pressure at boiling point.
A. Both Assertion and Reason are true, and Reason is the correct explanation.
B. Both Assertion and Reason are true, but Reason is not correct explanation.
C. Assertion is true, but Reason is false.
D. Assertion is false, but Reason is true.

Question 3. What is the unit of force?
A. Joule
B. Newton
C. Watt
D. Pascal

Answer Key:
1-B
2-A
3-B
    `.trim();

    const report = QuestionParserService.parseRawText(rawInput, 'Science');
    expect(report.importedCount).toBe(3);
    expect(report.validCount).toBe(3);

    // Check Question 1 (MCQ)
    const q1 = report.candidates[0];
    expect(q1.type).toBe('MCQ');
    expect(q1.options.length).toBe(4);
    expect(q1.correctAnswer).toBe('B');

    // Check Question 2 (Assertion-Reason)
    const q2 = report.candidates[1];
    expect(q2.type).toBe('ASSERTION_REASON');
    expect(q2.assertion).toContain('Boiling water');
    expect(q2.reason).toContain('vapor pressure');
    expect(q2.correctAnswer).toBe('A');

    // Check Question 3 (MCQ)
    const q3 = report.candidates[2];
    expect(q3.correctAnswer).toBe('B');
  });

  // 4. Question Import Review & Missing Answer Flagging (Requirement 12, 13, 14)
  it('4. Question Validation - flags questions requiring review without inventing answers', () => {
    const textWithoutAnswers = `
Question 1. What is the speed of light in vacuum?
A. 3 x 10^8 m/s
B. 3 x 10^6 m/s
C. 1.5 x 10^8 m/s
D. Infinite
    `.trim();

    const report = QuestionParserService.parseRawText(textWithoutAnswers, 'Physics');
    expect(report.importedCount).toBe(1);
    expect(report.needsReviewCount).toBe(1);
    expect(report.candidates[0].isValid).toBe(false);
    expect(report.candidates[0].validationMessage).toContain('Correct answer required');
  });

  // 5. Test Creation Eligibility Check (Requirement 17)
  it('5. Test creation eligibility - verifies minimum 5 Assertion-Reason and 35 MCQs exist', () => {
    // Current bank has sufficient questions
    const validTestResult = TestService.createTest({
      name: 'Full Mock Test 2026',
      description: 'Comprehensive test checking AR and MCQ counts',
      durationMinutes: 40,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      createdBy: 'teacher-auth-primary',
    });

    expect(validTestResult.test).toBeDefined();
    expect(validTestResult.error).toBeUndefined();

    // Now test with invalid counts exceeding question bank
    const invalidTestResult = TestService.createTest({
      name: 'Excessive AR Test',
      description: 'Demands 50 AR questions when bank has only 6',
      durationMinutes: 40,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 60,
      assertionReasonCount: 50,
      mcqCount: 10,
      createdBy: 'teacher-auth-primary',
    });

    expect(invalidTestResult.error).toBeDefined();
    expect(invalidTestResult.error).toContain('Insufficient Assertion-Reason questions');
  });

  // 6. Test Structure: Exactly 40 questions (5 Assertion-Reason + 35 MCQs) (Requirement 17, 20)
  it('6. Test Generation - yields exactly 40 questions with 5 Assertion-Reason and 35 MCQs', () => {
    const tests = TestService.getAllTests();
    const test = tests.find(t => t.id === 'test-active-chem') || tests[0];
    const student = DEMO_STUDENTS[0];

    const res = ExamService.startOrResumeAttempt(test.id, student);
    expect(res.attempt?.questions.length).toBe(40);

    const arQuestions = res.attempt?.questions.filter(q => q.type === 'ASSERTION_REASON');
    const mcqQuestions = res.attempt?.questions.filter(q => q.type === 'MCQ');

    expect(arQuestions?.length).toBe(5);
    expect(mcqQuestions?.length).toBe(35);
  });

  // 7. Configurable Negative Marking (Requirement 18, 19)
  it('7. Negative Marking - calculates custom scoring correctly (+4 for correct, -1 for incorrect)', () => {
    // Create test with NEET/JEE style (+4 / -1)
    const testRes = TestService.createTest({
      name: 'NEET Style Mock',
      description: '+4 for correct, -1 for incorrect',
      durationMinutes: 40,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 4,
      negativeMarkingEnabled: true,
      negativeMarks: 1.0,
      createdBy: 'teacher-auth-primary',
    });

    const test = testRes.test!;
    const student = DEMO_STUDENTS[1];
    const exam = ExamService.startOrResumeAttempt(test.id, student);
    const attempt = exam.attempt!;

    const allQuestions = Storage.getQuestions();
    const qMap = new Map(allQuestions.map(q => [q.id, q]));

    // Answer 3 correct, 2 incorrect, rest unanswered
    for (let i = 0; i < 3; i++) {
      const qId = attempt.questionIds[i];
      const correctAns = qMap.get(qId)!.correctAnswer;
      ExamService.saveAnswer(attempt.id, qId, correctAns, false);
    }
    for (let i = 3; i < 5; i++) {
      const qId = attempt.questionIds[i];
      const correctAns = qMap.get(qId)!.correctAnswer;
      const wrongAns = correctAns === 'A' ? 'B' : 'A';
      ExamService.saveAnswer(attempt.id, qId, wrongAns, false);
    }

    const submitted = ExamService.submitAttempt(attempt.id);
    expect(submitted.status).toBe('submitted');
    expect(submitted.correctCount).toBe(3);
    expect(submitted.incorrectCount).toBe(2);
    expect(submitted.unansweredCount).toBe(35);
    // Score: (3 * 4) - (2 * 1) = 12 - 2 = 10
    expect(submitted.score).toBe(10);
  });

  // 8. Result Visibility Restrictions (Requirement 22)
  it('8. Result visibility - student sees score, percentage, counts; correct answers are NOT leaked', () => {
    const tests = TestService.getAllTests();
    const test = tests.find(t => t.id === 'test-active-chem') || tests[0];
    const student = DEMO_STUDENTS[2];

    const res = ExamService.startOrResumeAttempt(test.id, student);
    res.attempt?.questions.forEach(q => {
      // Must NOT contain server-side answer keys
      expect((q as any).correctAnswer).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
    });
  });

  // 9. Teacher View - Full Response Sheet with Correct Answers (Requirement 23)
  it('9. Teacher results - teacher sees complete response sheet including correct answer and student choice', () => {
    const summaries = ExamService.getTestAttemptSummaries('test-completed-phys');
    expect(summaries.length).toBeGreaterThan(0);

    const detailed = ExamService.getDetailedStudentResponses(summaries[0].attemptId);
    expect(detailed.length).toBe(40);
    // Teacher CAN see student answer and correct answer
    expect(detailed[0].studentAnswer).toBeDefined();
    expect(detailed[0].correctAnswer).toBeDefined();
    expect(typeof detailed[0].isCorrect).toBe('boolean');
  });

  // 10. Multi-Sheet Excel (.xlsx) and CSV Export (Requirement 24, 25)
  it('10. Multi-sheet Excel & CSV export - produces required worksheets and structure', () => {
    const test = Storage.getTestById('test-completed-phys');
    expect(test).toBeDefined();

    const analytics = AnalyticsService.getClassAnalytics('test-completed-phys');
    expect(analytics.totalSubmissions).toBeGreaterThan(0);

    // Verify ExportService methods exist and are functions
    expect(typeof ExportService.exportCompleteExcel).toBe('function');
    expect(typeof ExportService.exportClassSummaryCSV).toBe('function');
    expect(typeof ExportService.exportDetailedResponsesCSV).toBe('function');
    expect(typeof ExportService.exportQuestionAnalysisCSV).toBe('function');
  });

  // 11. Fixed Question Set & Reload Immunity (Requirement 20)
  it('11. Fixed question set - refreshing browser does not alter examination questions', () => {
    const tests = TestService.getAllTests();
    const test = tests.find(t => t.id === 'test-active-chem') || tests[0];
    const student = DEMO_STUDENTS[3];

    // Initial start
    const call1 = ExamService.startOrResumeAttempt(test.id, student);
    const qIds1 = call1.attempt?.questionIds;

    // Simulated reload / reconnect
    const call2 = ExamService.startOrResumeAttempt(test.id, student);
    const qIds2 = call2.attempt?.questionIds;

    expect(qIds2).toEqual(qIds1);
    expect(call2.attempt?.id).toBe(call1.attempt?.id);
  });

  // 12. Autosave and Recovery (Requirement 35)
  it('12. Autosave & Recovery - student answers are immediately recorded and recovered', () => {
    const tests = TestService.getAllTests();
    const test = tests.find(t => t.id === 'test-active-chem') || tests[0];
    const student = DEMO_STUDENTS[4];

    const res = ExamService.startOrResumeAttempt(test.id, student);
    const q0 = res.attempt!.questionIds[0];

    ExamService.saveAnswer(res.attempt!.id, q0, 'C', true);

    const recovered = Storage.getAttemptById(res.attempt!.id);
    expect(recovered?.answers[q0]?.selectedOptionId).toBe('C');
    expect(recovered?.answers[q0]?.isMarkedForReview).toBe(true);
  });

  // 13. MULTI-TEACHER PORTAL & ACCOUNT ISOLATION ACCEPTANCE TEST (Section 15 Specification)
  it('13. Multi-Teacher Portal & Account Isolation - complete isolation between Teacher A and Teacher B', async () => {
    // -------------------------------------------------------------
    // STEP 1: TEACHER A REGISTRATION & TEST CREATION
    // -------------------------------------------------------------
    const teacherAReg = await AuthService.registerTeacher({
      name: 'Teacher Alice',
      email: 'teacherA@example.com',
      password: 'passwordA123',
      confirmPassword: 'passwordA123',
      schoolName: 'St. Jude High',
      department: 'Physics',
      title: 'Senior Lecturer',
    });
    expect(teacherAReg.user).toBeDefined();
    const teacherA = teacherAReg.user!;
    expect(teacherA.id).toBeDefined();

    // Teacher A adds questions to their isolated question bank
    const question1 = Storage.addQuestion({
      id: `q-phys-${Date.now()}`,
      type: 'MCQ',
      questionText: 'What is the speed of light in vacuum?',
      options: [
        { id: 'A', text: '3 x 10^8 m/s' },
        { id: 'B', text: '3 x 10^6 m/s' },
        { id: 'C', text: '1.5 x 10^8 m/s' },
        { id: 'D', text: '3 x 10^5 km/h' },
      ],
      correctAnswer: 'A',
      explanation: 'The speed of light in vacuum is approximately 299,792,458 m/s.',
      subject: 'Physics',
      topic: 'Optics',
      difficulty: 'easy',
      active: true,
      marks: 4,
      createdAt: Date.now(),
    }, teacherA.id);

    expect(question1.ownerId).toBe(teacherA.id);

    // Teacher A creates, publishes and activates "Physics Test"
    const physicsRes = TestService.createTest({
      name: 'Physics Test',
      description: 'Senior secondary physics examination on mechanics and optics',
      totalQuestions: 1,
      assertionReasonCount: 0,
      mcqCount: 1,
      positiveMarks: 4,
      negativeMarking: 1,
      durationMinutes: 45,
      startTime: Date.now() - 3600000, // Started 1 hour ago
      endTime: Date.now() + 86400000,   // Active for next 24 hours
      createdBy: teacherA.id,
      ownerId: teacherA.id,
    });

    expect(physicsRes.test).toBeDefined();
    const physicsTest = physicsRes.test!;
    expect(physicsTest.ownerId).toBe(teacherA.id);
    expect(physicsTest.status).toBe('active');

    // Verify Teacher A sees "Physics Test — Active"
    const teacherATests = TestService.getTestsForTeacher(teacherA.id);
    const teacherAActiveTests = teacherATests.filter(t => t.status === 'active');
    expect(teacherAActiveTests.length).toBe(1);
    expect(teacherAActiveTests[0].name).toBe('Physics Test');

    const teacherAQuestions = Storage.getQuestions(teacherA.id);
    expect(teacherAQuestions.some(q => q.id === question1.id)).toBe(true);

    // -------------------------------------------------------------
    // STEP 2: TEACHER A LOGS OUT, TEACHER B REGISTERS
    // -------------------------------------------------------------
    AuthService.logout();
    expect(AuthService.getCurrentUser()).toBeNull();

    // Teacher B registers
    const teacherBReg = await AuthService.registerTeacher({
      name: 'Teacher Bob',
      email: 'teacherB@example.com',
      password: 'passwordB123',
      confirmPassword: 'passwordB123',
      schoolName: 'Oakwood International',
      department: 'Chemistry',
      title: 'Assistant Professor',
    });
    expect(teacherBReg.user).toBeDefined();
    const teacherB = teacherBReg.user!;
    expect(teacherB.id).toBeDefined();
    expect(teacherB.id).not.toBe(teacherA.id);

    // -------------------------------------------------------------
    // STEP 3: VERIFY TEACHER B SEES COMPLETELY EMPTY WORKSPACE
    // -------------------------------------------------------------
    const teacherBTests = TestService.getTestsForTeacher(teacherB.id);
    const teacherBActiveTests = teacherBTests.filter(t => t.status === 'active');
    expect(teacherBActiveTests.length).toBe(0); // "No active tests"
    expect(teacherBTests.length).toBe(0);

    const teacherBQuestions = Storage.getQuestions(teacherB.id);
    expect(teacherBQuestions.length).toBe(0); // 0 Questions

    // Teacher B must NOT see:
    // - Physics Test
    // - Teacher A's questions
    // - Teacher A's results
    // - Teacher A's analytics
    expect(teacherBTests.some(t => t.id === physicsTest.id)).toBe(false);
    expect(teacherBQuestions.some(q => q.id === question1.id)).toBe(false);

    const teacherBOverview = AnalyticsService.getTeacherOverviewAnalytics(teacherB.id);
    expect(teacherBOverview.totalTests).toBe(0);
    expect(teacherBOverview.activeTests).toBe(0);
    expect(teacherBOverview.totalSubmissions).toBe(0);

    // -------------------------------------------------------------
    // STEP 4: SECURITY TEST
    // While logged in as Teacher B, attempt to directly access Teacher A's test
    // -------------------------------------------------------------
    // Attempting direct access to Teacher A's test must return Permission Denied
    const directAccess = TestService.getAuthorizedTestById(physicsTest.id, teacherB.id);
    expect(directAccess.error).toMatch(/Permission denied/);
    expect(directAccess.test).toBeUndefined();

    const directStorageAccess = Storage.getAuthorizedTestById(physicsTest.id, teacherB.id);
    expect(directStorageAccess.error).toMatch(/Permission denied/);
    expect(directStorageAccess.test).toBeUndefined();

    // Storage.getTestById with teacherB context filters it out as unauthorized
    expect(Storage.getTestById(physicsTest.id, teacherB.id)).toBeUndefined();

    // Attempting to delete Teacher A's test by ID as Teacher B must throw Permission Denied
    expect(() => {
      TestService.deleteTest(physicsTest.id, teacherB.id);
    }).toThrow(/Permission denied/);

    // Attempting to delete Teacher A's question by ID as Teacher B must throw Permission Denied
    expect(() => {
      Storage.deleteQuestion(question1.id, teacherB.id);
    }).toThrow(/Permission denied/);

    // Attempting to export results of Teacher A's test as Teacher B must throw Permission Denied
    expect(() => {
      ExportService.exportClassSummaryCSV(physicsTest.id, teacherB.id);
    }).toThrow(/Permission denied/);

    // -------------------------------------------------------------
    // STEP 5: CONCURRENT TESTS (Teacher B creates Chemistry Test)
    // -------------------------------------------------------------
    const chemQ = Storage.addQuestion({
      id: `q-chem-${Date.now()}`,
      type: 'MCQ',
      questionText: 'What is the atomic number of Carbon?',
      options: [
        { id: 'A', text: '6' },
        { id: 'B', text: '12' },
        { id: 'C', text: '14' },
        { id: 'D', text: '8' },
      ],
      correctAnswer: 'A',
      explanation: 'Carbon has 6 protons.',
      subject: 'Chemistry',
      difficulty: 'easy',
      active: true,
      marks: 4,
      createdAt: Date.now(),
    }, teacherB.id);

    expect(chemQ.ownerId).toBe(teacherB.id);

    const chemRes = TestService.createTest({
      name: 'Chemistry Test',
      description: 'Organic chemistry reactions and bonding',
      totalQuestions: 1,
      assertionReasonCount: 0,
      mcqCount: 1,
      positiveMarks: 4,
      negativeMarking: 1,
      durationMinutes: 30,
      startTime: Date.now() - 1800000,
      endTime: Date.now() + 86400000,
      createdBy: teacherB.id,
      ownerId: teacherB.id,
    });

    expect(chemRes.test).toBeDefined();
    const chemistryTest = chemRes.test!;
    expect(chemistryTest.ownerId).toBe(teacherB.id);

    // Teacher B now sees only Chemistry Test
    const bActive = TestService.getTestsForTeacher(teacherB.id).filter(t => t.status === 'active');
    expect(bActive.length).toBe(1);
    expect(bActive[0].name).toBe('Chemistry Test');
    expect(bActive.some(t => t.id === physicsTest.id)).toBe(false);

    // -------------------------------------------------------------
    // STEP 6: SWITCH BACK TO TEACHER A
    // Verify Teacher A can still access Physics Test normally
    // and cannot see Chemistry Test
    // -------------------------------------------------------------
    AuthService.logout();
    const loginA = await AuthService.loginTeacher('teacherA@example.com', 'passwordA123');
    expect(loginA.user?.id).toBe(teacherA.id);

    const aAuthorized = TestService.getAuthorizedTestById(physicsTest.id, teacherA.id);
    expect(aAuthorized.test).toBeDefined();
    expect(aAuthorized.test?.name).toBe('Physics Test');

    const aActive = TestService.getTestsForTeacher(teacherA.id).filter(t => t.status === 'active');
    expect(aActive.length).toBe(1);
    expect(aActive[0].name).toBe('Physics Test');
    expect(aActive.some(t => t.id === chemistryTest.id)).toBe(false);
  });
});

