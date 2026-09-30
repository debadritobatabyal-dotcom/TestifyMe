import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, safeStorage } from '../src/services/storage';
import { TestService } from '../src/services/testService';
import { ExamService } from '../src/services/examService';
import { DEMO_STUDENTS, DEMO_QUESTIONS } from '../src/services/demoData';

describe('TestifyMe Test-Link Resolution & Availability Verification (Requirements 1-16)', () => {
  const teacherAId = 'teacher-alpha-123';
  const teacherBId = 'teacher-beta-456';

  beforeEach(() => {
    safeStorage.clear();
    // Seed questions for Teacher A
    const teacherQuestions = DEMO_QUESTIONS.map(q => ({
      ...q,
      ownerId: teacherAId,
    }));
    Storage.saveQuestions(teacherQuestions);
    DEMO_STUDENTS.forEach(s => Storage.saveUser(s));
  });

  // Test 1 — Valid code lookup (CLAS-FM5D)
  it('Test 1 — Valid code CLAS-FM5D is found and resolved', async () => {
    const test = Storage.saveTest({
      id: 'test-clas-fm5d',
      name: 'Class 10 Physics Assessment',
      description: 'Optics and Electricity',
      testCode: 'CLAS-FM5D',
      accessCode: 'CLAS-FM5D',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 45,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 4,
      negativeMarkingEnabled: true,
      negativeMarks: 1,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    expect(test.testCode).toBe('CLAS-FM5D');

    // Case-insensitive lookup (clas-fm5d vs CLAS-FM5D)
    const foundUpper = TestService.getTestByAccessCode('CLAS-FM5D');
    expect(foundUpper).toBeDefined();
    expect(foundUpper?.name).toBe('Class 10 Physics Assessment');

    const foundLower = TestService.getTestByAccessCode('clas-fm5d');
    expect(foundLower).toBeDefined();
    expect(foundLower?.id).toBe(test.id);

    // Asynchronous resolution (supports cloud / dev server)
    const asyncResolved = await TestService.resolveTestByCode('CLAS-FM5D');
    expect(asyncResolved.test).toBeDefined();
    expect(asyncResolved.error).toBeUndefined();
  });

  // Test 2 — Invalid code lookup (XXXX-9999)
  it('Test 2 — Invalid code XXXX-9999 returns not found without crashing', async () => {
    const syncResult = TestService.getTestByAccessCode('XXXX-9999');
    expect(syncResult).toBeUndefined();

    const asyncResult = await TestService.resolveTestByCode('XXXX-9999');
    expect(asyncResult.test).toBeUndefined();
    expect(asyncResult.error).toContain('No examination found matching test code "XXXX-9999"');
  });

  // Test 3 — Student access: normal student opens valid published test link
  it('Test 3 — Normal student opens a valid published test link without requiring teacher login', async () => {
    // Teacher creates test
    Storage.saveTest({
      id: 'test-biology-cell',
      name: 'Cell Biology Midterm',
      description: 'Comprehensive test on cell structure and organelles',
      testCode: 'BIO-CELL',
      accessCode: 'BIO-CELL',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 60,
      startTime: Date.now() - 10000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    // Student (not logged in as teacher) looks up code
    const student = DEMO_STUDENTS[0];
    const resolved = TestService.getTestByAccessCode('BIO-CELL');
    expect(resolved).toBeDefined();

    // Verify test availability
    const availability = TestService.getTestAvailability(resolved!);
    expect(availability.isAvailable).toBe(true);
    expect(availability.status).toBe('active');

    // Student starts exam successfully
    const examAttempt = ExamService.startOrResumeAttempt(resolved!.id, student);
    expect(examAttempt.attempt).toBeDefined();
    expect(examAttempt.attempt?.studentId).toBe(student.id);
  });

  // Test 4 — Teacher isolation: Teacher B cannot see Teacher A's test in their dashboard
  it("Test 4 — Teacher B logs in and cannot see Teacher A's test", () => {
    // Teacher A test
    Storage.saveTest({
      id: 'test-physics-a',
      name: 'Advanced Mechanics',
      description: 'Newtonian mechanics and rotational motion',
      testCode: 'PHYS-A101',
      accessCode: 'PHYS-A101',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 45,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 4,
      negativeMarkingEnabled: true,
      negativeMarks: 1,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    // Teacher B checks their dashboard
    const teacherBTests = TestService.getTestsForTeacher(teacherBId);
    expect(teacherBTests.some(t => t.id === 'test-physics-a')).toBe(false);
    expect(teacherBTests.some(t => t.testCode === 'PHYS-A101')).toBe(false);
    expect(teacherBTests.length).toBe(0);
  });

  // Test 5 — Student cannot access teacher data: direct API access gives permission denied
  it('Test 5 — Student cannot access teacher dashboard or test management data', () => {
    const student = DEMO_STUDENTS[1];

    const test = Storage.saveTest({
      id: 'test-chem-secret',
      name: 'Organic Chemistry',
      description: 'Reactions and pathways',
      testCode: 'CHEM-SEC1',
      accessCode: 'CHEM-SEC1',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 30,
      startTime: Date.now() - 3600000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 4,
      negativeMarkingEnabled: true,
      negativeMarks: 1,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    // Attempting authorized teacher retrieval with student UID throws or returns error
    const authCheck = Storage.getAuthorizedTestById(test.id, student.id);
    expect(authCheck.error).toContain('Permission denied');
    expect(authCheck.test).toBeUndefined();

    // Student attempting to delete test throws Permission Denied
    expect(() => {
      Storage.deleteTest(test.id, student.id);
    }).toThrow(/Permission denied/);
  });

  // Test 6 — Expired test shows Test unavailable / expired (NOT "Test Code Not Found")
  it('Test 6 — Expired test shows Test Closed/Unavailable, NOT Test Code Not Found', () => {
    const pastTime = Date.now() - 7200000;
    const expiredTest = Storage.saveTest({
      id: 'test-expired-1',
      name: 'Expired Chemistry Final',
      description: 'Test that ended 2 hours ago',
      testCode: 'CHEM-PAST',
      accessCode: 'CHEM-PAST',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 60,
      startTime: pastTime - 3600000,
      endTime: pastTime, // Ended in the past
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'closed',
      isPublished: true,
      createdAt: pastTime - 7200000,
    }, teacherAId);
    expect(expiredTest.id).toBeDefined();

    // Test IS found by code!
    const found = TestService.getTestByAccessCode('CHEM-PAST');
    expect(found).toBeDefined();

    // Availability indicates closed / expired, NOT missing code
    const availability = TestService.getTestAvailability(found!);
    expect(availability.status).toBe('closed');
    expect(availability.isAvailable).toBe(false);
    expect(availability.message).toBe('This test is no longer available.');
  });

  // Test 7 — Scheduled test shows starts on [date/time] (NOT "Test Code Not Found")
  it('Test 7 — Scheduled test shows starts on [date/time], NOT Test Code Not Found', () => {
    const futureTime = Date.now() + 86400000; // Tomorrow
    const scheduledTest = Storage.saveTest({
      id: 'test-scheduled-1',
      name: 'Upcoming Physics Olympiad',
      description: 'Starts tomorrow',
      testCode: 'PHYS-FUTR',
      accessCode: 'PHYS-FUTR',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 90,
      startTime: futureTime,
      endTime: futureTime + 7200000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 4,
      negativeMarkingEnabled: true,
      negativeMarks: 1,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'scheduled',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);
    expect(scheduledTest.id).toBeDefined();

    // Test IS found by code!
    const found = TestService.getTestByAccessCode('PHYS-FUTR');
    expect(found).toBeDefined();

    // Availability indicates scheduled with start date/time
    const availability = TestService.getTestAvailability(found!);
    expect(availability.status).toBe('not_started');
    expect(availability.isAvailable).toBe(false);
    expect(availability.message).toContain('This test starts on');
  });

  // Test 8 — Refresh immunity: Student starts test -> refreshes page -> same attempt, questions, and timer
  it('Test 8 — Browser refresh retains the exact same attempt, question set, and timer', () => {
    const test = Storage.saveTest({
      id: 'test-refresh-immunity',
      name: 'General Science Assessment',
      description: 'Testing attempt persistence',
      testCode: 'GEN-SCI1',
      accessCode: 'GEN-SCI1',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 40,
      startTime: Date.now() - 60000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      allowUnanswered: true,
      randomizeQuestions: true,
      randomizeOptions: true,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    const student = DEMO_STUDENTS[2];

    // Initial Start
    const firstCall = ExamService.startOrResumeAttempt(test.id, student);
    expect(firstCall.attempt).toBeDefined();
    const attempt1 = firstCall.attempt!;
    const originalQuestions = [...attempt1.questionIds];
    const originalExpiresAt = attempt1.expiresAt;

    // Student answers a question
    ExamService.saveAnswer(attempt1.id, originalQuestions[0], 'B', false);

    // Simulated Page Refresh / Re-mount
    const secondCall = ExamService.startOrResumeAttempt(test.id, student);
    expect(secondCall.attempt).toBeDefined();
    const attempt2 = secondCall.attempt!;

    // Must be identical attempt ID
    expect(attempt2.id).toBe(attempt1.id);
    // Must have identical questions in identical sequence
    expect(attempt2.questionIds).toEqual(originalQuestions);
    // Must have identical expiration timer
    expect(attempt2.expiresAt).toBe(originalExpiresAt);
    // Must preserve recorded answer
    expect(attempt2.answers[originalQuestions[0]].selectedOptionId).toBe('B');
  });

  // Test 9 — Question distribution: Teacher creates 40 total (35 MCQ, 5 AR) -> Student receives 40 total (35 MCQ, 5 AR)
  it('Test 9 — Student receives exact 40 total questions (35 MCQ + 5 Assertion-Reason)', () => {
    const test = Storage.saveTest({
      id: 'test-distribution-check',
      name: 'Balanced Distribution Exam',
      description: 'Strict 35 MCQ and 5 Assertion-Reason check',
      testCode: 'DIST-3505',
      accessCode: 'DIST-3505',
      ownerId: teacherAId,
      createdBy: teacherAId,
      durationMinutes: 50,
      startTime: Date.now() - 60000,
      endTime: Date.now() + 86400000,
      totalQuestions: 40,
      assertionReasonCount: 5,
      mcqCount: 35,
      positiveMarks: 1,
      negativeMarkingEnabled: true,
      negativeMarks: 0.25,
      allowUnanswered: true,
      randomizeQuestions: false,
      randomizeOptions: false,
      maxAttempts: 1,
      status: 'active',
      isPublished: true,
      createdAt: Date.now(),
    }, teacherAId);

    const student = DEMO_STUDENTS[3];
    const exam = ExamService.startOrResumeAttempt(test.id, student);
    expect(exam.attempt).toBeDefined();
    const attempt = exam.attempt!;

    // Total questions must be exactly 40
    expect(attempt.questions.length).toBe(40);
    expect(attempt.questionIds.length).toBe(40);

    // Assertion-Reason questions count must be exactly 5
    const arQuestions = attempt.questions.filter(q => q.type === 'ASSERTION_REASON');
    expect(arQuestions.length).toBe(5);

    // MCQ questions count must be exactly 35
    const mcqQuestions = attempt.questions.filter(q => q.type === 'MCQ');
    expect(mcqQuestions.length).toBe(35);

    // Student questions must NOT leak correct answers
    attempt.questions.forEach(q => {
      expect((q as any).correctAnswer).toBeUndefined();
      expect((q as any).explanation).toBeUndefined();
    });
  });
});
