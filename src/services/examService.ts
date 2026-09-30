import {
  TestAttempt,
  Question,
  StudentSafeQuestion,
  User,
  DetailedStudentResponse,
  StudentAttemptSummary,
} from '../types';
import { Storage } from './storage';
import { TestService } from './testService';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../config/firebase';

export const ExamService = {
  // Start or resume an exam attempt for an authenticated student
  startOrResumeAttempt(testId: string, student: User): { attempt?: TestAttempt; error?: string } {
    // Stage 1 — Resolve Test
    console.log(`[TEST] Test resolution for attempt: testId=${testId}`);
    const test = TestService.getTestById(testId);
    if (!test) {
      console.error(`[TEST] FAILED: Test not found with id ${testId}`);
      return { error: 'Test not found.' };
    }
    console.log(`[TEST] Test resolved: ${test.testCode || test.accessCode || test.id}`);

    // Stage 2 — Authenticate Student
    console.log(`[AUTH] Student UID: ${student?.id}`);
    console.log(`[AUTH] Role: ${student?.role}`);
    if (!student || !student.id || student.role !== 'student') {
      console.error(`[AUTH] FAILED: Invalid student credentials or role (${student?.role})`);
      return { error: 'Valid student authentication is required to attempt this examination.' };
    }

    // Stage 3 — Authorize Student For Test
    const availability = TestService.getTestAvailability(test);
    console.log(`[TEST] Availability: ${availability.status} (isAvailable=${availability.isAvailable})`);
    if (!availability.isAvailable) {
      console.warn(`[TEST] FAILED: Test unavailable - ${availability.message}`);
      return { error: availability.message };
    }

    // Stage 4 — Create or Resume Attempt (Idempotent: deterministic lookup)
    const deterministicAttemptId = `att-${test.id}-${student.id}`;
    console.log(`[ATTEMPT] Checking existing attempt for studentId=${student.id}, testId=${test.id}...`);

    const existing =
      Storage.getStudentAttemptForTest(student.id, test.id) ||
      Storage.getAttemptById(deterministicAttemptId);

    if (existing) {
      console.log(`[ATTEMPT] Existing attempt found: id=${existing.id}, status=${existing.status}`);
      if (existing.status === 'submitted') {
        return { attempt: existing };
      }

      // Check if time expired in background
      if (Date.now() >= existing.expiresAt) {
        console.log(`[ATTEMPT] Attempt ${existing.id} has expired, submitting automatically...`);
        const autoSubmitted = this.submitAttempt(existing.id);
        return { attempt: autoSubmitted };
      }

      // Return existing in-progress attempt (FIXED question set preserved - Requirement 14, 15, 20)
      console.log(`[ATTEMPT] Resuming existing in-progress attempt ${existing.id}`);
      return { attempt: existing };
    }

    console.log('[ATTEMPT] No existing attempt');
    console.log(`[ATTEMPT] Creating attempt: id=${deterministicAttemptId}...`);

    // Prepare questions: check if pre-packaged on test, or sample from bank
    let safeQuestions: StudentSafeQuestion[] = [];

    if (test.questions && test.questions.length >= (test.assertionReasonCount + test.mcqCount)) {
      // Test has pre-packaged safe questions! Use directly
      let packaged = [...test.questions];
      if (test.randomizeQuestions) {
        packaged = shuffleArray(packaged);
      }
      if (test.randomizeOptions) {
        packaged = packaged.map(q =>
          q.type === 'MCQ' ? { ...q, options: shuffleArray(q.options) } : q
        );
      }
      safeQuestions = packaged;
    } else {
      // Fallback: check active questions in question bank if accessible (e.g. same teacher session)
      const teacherQuestions = Storage.getQuestions(test.ownerId || test.createdBy).filter(q => q.active);
      const activeQuestions =
        teacherQuestions.length >= test.assertionReasonCount + test.mcqCount
          ? teacherQuestions
          : Storage.getQuestions().filter(q => q.active);

      const arQuestions = activeQuestions.filter(q => q.type === 'ASSERTION_REASON');
      const mcqQuestions = activeQuestions.filter(q => q.type === 'MCQ');

      const reqAR = test.assertionReasonCount;
      const reqMCQ = test.mcqCount;

      if (arQuestions.length < reqAR || mcqQuestions.length < reqMCQ) {
        console.error(
          `[ATTEMPT] FAILED: Insufficient questions. AR: ${arQuestions.length}/${reqAR}, MCQ: ${mcqQuestions.length}/${reqMCQ}`
        );
        return {
          error: `Insufficient questions in question bank. Requires ${reqAR} Assertion–Reason and ${reqMCQ} standard MCQs. Please notify your instructor.`,
        };
      }

      const selectedAR = sampleRandom(arQuestions, reqAR);
      const selectedMCQ = sampleRandom(mcqQuestions, reqMCQ);
      let combined = [...selectedAR, ...selectedMCQ];

      if (test.randomizeQuestions) {
        combined = shuffleArray(combined);
      }

      safeQuestions = combined.map(q => {
        let options = [...q.options];
        if (test.randomizeOptions && q.type === 'MCQ') {
          options = shuffleArray(options);
        }
        return {
          id: q.id,
          type: q.type,
          questionText: q.questionText,
          assertion: q.assertion,
          reason: q.reason,
          options,
          marks: test.positiveMarks || q.marks || 1,
          subject: q.subject,
          chapter: q.chapter,
          topic: q.topic,
          difficulty: q.difficulty,
        };
      });
    }

    const now = Date.now();
    const durationMs = test.durationMinutes * 60 * 1000;
    const expiresAt = Math.min(now + durationMs, test.endTime);

    // CRITICAL (Requirement 3 & 8): studentId MUST strictly be the authenticated student UID
    const attempt: TestAttempt = {
      id: deterministicAttemptId,
      testId: test.id,
      ownerId: test.ownerId || test.createdBy,
      studentId: student.id,
      studentName: student.name,
      studentEmail: student.email,
      studentRollNumber: student.studentId,
      questionIds: safeQuestions.map(q => q.id),
      questions: safeQuestions,
      answers: {},
      startedAt: now,
      expiresAt,
      status: 'in_progress',
    };

    try {
      Storage.saveAttempt(attempt);
      console.log(`[ATTEMPT] Attempt created successfully: id=${attempt.id}, questions=${safeQuestions.length}`);
    } catch (saveErr: any) {
      console.error(`[ATTEMPT] FAILED`);
      console.error(`[ATTEMPT] Firebase error: ${saveErr.code || saveErr.message}`);
      return { error: `Failed to initialize test attempt: ${saveErr.message}` };
    }

    return { attempt };
  },

  // Save student answer (debounced autosave)
  saveAnswer(attemptId: string, questionId: string, selectedOptionId: string | null, isMarkedForReview: boolean): TestAttempt {
    const attempt = Storage.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    if (attempt.status === 'submitted') return attempt;

    if (Date.now() >= attempt.expiresAt) {
      return this.submitAttempt(attemptId);
    }

    attempt.answers[questionId] = {
      questionId,
      selectedOptionId,
      isMarkedForReview,
      savedAt: Date.now(),
    };

    Storage.saveAttempt(attempt);
    return attempt;
  },

  // Submit test and evaluate score on server (Requirement 18 & 22)
  submitAttempt(attemptId: string): TestAttempt {
    const attempt = Storage.getAttemptById(attemptId);
    if (!attempt) throw new Error('Attempt not found');

    if (attempt.status === 'submitted') return attempt;

    const test = Storage.getTestById(attempt.testId);
    const positiveMarks = test?.positiveMarks ?? 1;
    const negativeMarkingEnabled = test?.negativeMarkingEnabled ?? true;
    const negativeMarks = negativeMarkingEnabled ? (test?.negativeMarks ?? 0.25) : 0;

    let correctCount = 0;
    let incorrectCount = 0;
    let unansweredCount = 0;
    let totalScore = 0;

    const allQuestions = Storage.getQuestions();
    const questionMap = new Map<string, Question>(allQuestions.map(q => [q.id, q]));
    const answerKeys = test?.answerKeys || {};

    for (const qId of attempt.questionIds) {
      const q = questionMap.get(qId);
      const studentAns = attempt.answers[qId];
      const selected = studentAns?.selectedOptionId;
      const correctAns = answerKeys[qId] || q?.correctAnswer;

      if (!selected) {
        unansweredCount++;
      } else if (correctAns && selected === correctAns) {
        correctCount++;
        totalScore += positiveMarks;
      } else {
        incorrectCount++;
        totalScore -= negativeMarks;
      }
    }

    const finalScore = Math.max(0, Math.round(totalScore * 100) / 100);
    const maxScore = attempt.questionIds.length * positiveMarks;
    const percentage = maxScore > 0 ? Math.round((finalScore / maxScore) * 1000) / 10 : 0;

    console.log(
      `[SUBMIT]\nStudent UID: ${attempt.studentId}\nTest ID: ${attempt.testId}\nAttempt ID: ${attempt.id}`
    );
    console.log(`[SUBMISSION] Received for attempt ${attempt.id}`);
    console.log(`[SUBMIT]\nSaving final answers...`);
    console.log(`[SUBMIT]\nCalculating score...`);
    console.log(
      `[SUBMISSION] Scored: ${finalScore}/${maxScore} (${percentage}%), Correct: ${correctCount}, Incorrect: ${incorrectCount}`
    );
    console.log(`[SUBMIT]\nWriting submission...`);

    attempt.score = finalScore;
    attempt.maxScore = maxScore;
    attempt.correctCount = correctCount;
    attempt.incorrectCount = incorrectCount;
    attempt.unansweredCount = unansweredCount;
    attempt.percentage = percentage;
    attempt.submittedAt = Date.now();
    attempt.status = 'submitted';

    Storage.saveAttempt(attempt);

    console.log(`[SUBMIT]\nFirestore write successful`);
    console.log(`[SUBMISSION] Persisted: attempt ${attempt.id}`);
    console.log(`[SUBMIT]\nAttempt status = submitted`);

    return attempt;
  },

  // Real-time Teacher Attempt Subscription (Requirements 6, 7, 8, 22)
  subscribeToTeacherAttempts(
    teacherId: string,
    testId?: string,
    callback?: (attempts: TestAttempt[]) => void
  ): () => void {
    if (!teacherId) return () => {};

    console.log(`[TEACHER_RESULTS] Listener started for teacherId=${teacherId}, testId=${testId || 'all'}`);

    let active = true;
    let firestoreUnsubscribe: (() => void) | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    // Helper to get local scoped attempts
    const getLocal = () => {
      return Storage.getAttempts(testId, teacherId);
    };

    // 1. Initial callback with cached/stored attempts
    if (callback) {
      callback(getLocal());
    }

    // 2. Cloud Firestore Realtime Listener (Requirements 6, 7, 8)
    if (db) {
      try {
        // Build Firestore query constraints. For guest/unauthenticated teacher (id 'guest-teacher'), omit ownerId filter to retrieve all attempts.
        const constraints = [] as any[];
        if (teacherId && teacherId !== 'guest-teacher') {
          constraints.push(where('ownerId', '==', teacherId));
        }
        if (testId) {
          constraints.push(where('testId', '==', testId));
        }
        const q = query(collection(db, 'attempts'), ...constraints);

        firestoreUnsubscribe = onSnapshot(
          q,
          snapshot => {
            if (!active) return;
            console.log(`[TEACHER_RESULTS] Snapshot received: ${snapshot.docs.length} attempts`);
            const remote = snapshot.docs.map(doc => doc.data() as TestAttempt);
            remote.forEach(att => Storage.saveAttempt(att, false));
            console.log(`[TEACHER_RESULTS] Results count: ${remote.length}`);
            if (callback) {
              callback(testId ? remote.filter(a => a.testId === testId) : remote);
            }
          },
          err => {
            console.error(`[TEACHER_RESULTS] Firestore onSnapshot error: ${err.code || err.message}`);
          }
        );
      } catch (err: any) {
        console.warn('[TEACHER_RESULTS] Failed to initialize Firestore onSnapshot:', err);
      }
    }

    // 3. Dev-Server Realtime Sync Poller (Fallback when Cloud Firestore is not configured or in local dev)
    if (!db && typeof window !== 'undefined' && typeof window.fetch === 'function') {
      let lastSerialized = '';

      const fetchSync = async () => {
        if (!active) return;
        try {
          const url = `/api/attempts?teacherId=${encodeURIComponent(teacherId)}${
            testId ? `&testId=${encodeURIComponent(testId)}` : ''
          }`;
          const res = await fetch(url);
          const contentType = res.headers?.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const data: TestAttempt[] = await res.json();
            const serialized = JSON.stringify(data);
            if (serialized !== lastSerialized) {
              lastSerialized = serialized;
              console.log(`[TEACHER_RESULTS] Snapshot received from sync: ${data.length} attempts`);
              data.forEach(att => Storage.saveAttempt(att, false));
              console.log(`[TEACHER_RESULTS] Results count: ${data.length}`);
              if (callback && active) {
                callback(data);
              }
            }
          }
        } catch {
          // ignore dev server polling errors
        }
      };

      fetchSync();
      pollInterval = setInterval(fetchSync, 1000);
    }

    // 4. In-Window Custom Event Listener (0ms latency for same tab/window)
    const handleAttemptUpdate = (e: any) => {
      if (!active) return;
      const updatedAttempt = e.detail as TestAttempt;
      if (testId && updatedAttempt.testId !== testId) return;
      if (updatedAttempt.ownerId && updatedAttempt.ownerId !== teacherId) return;

      console.log(`[TEACHER_RESULTS] Live update event for attempt: ${updatedAttempt.id}`);
      if (callback) {
        callback(getLocal());
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('testifyme_attempt_updated', handleAttemptUpdate);
    }

    return () => {
      active = false;
      if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
      }
      if (pollInterval) {
        clearInterval(pollInterval);
      }
      if (typeof window !== 'undefined') {
        window.removeEventListener('testifyme_attempt_updated', handleAttemptUpdate);
      }
      console.log(`[TEACHER_RESULTS] Listener stopped for teacherId=${teacherId}`);
    };
  },

  // Detailed student responses for Teacher inspection (Requirement 23)
  getDetailedStudentResponses(attemptId: string, attemptParam?: TestAttempt): DetailedStudentResponse[] {
    const attempt = attemptParam || Storage.getAttemptById(attemptId);
    if (!attempt) return [];

    const allQuestions = Storage.getQuestions();
    const qMap = new Map<string, Question>(allQuestions.map(q => [q.id, q]));
    const safeQMap = new Map<string, StudentSafeQuestion>(
      attempt.questions ? attempt.questions.map(q => [q.id, q]) : []
    );
    const test = Storage.getTestById(attempt.testId);
    const posMarks = test?.positiveMarks || 1;
    const negMarks = test?.negativeMarkingEnabled ? test.negativeMarks : 0;

    return attempt.questionIds.map(qId => {
      const q = qMap.get(qId);
      const safeQ = safeQMap.get(qId);
      const ans = attempt.answers[qId];
      const selected = ans?.selectedOptionId || null;
      const isUnanswered = !selected;
      const correctAns = test?.answerKeys?.[qId] || q?.correctAnswer || '';
      const isCorrect = !isUnanswered && Boolean(correctAns) && selected === correctAns;

      return {
        questionId: qId,
        questionText: q?.questionText || safeQ?.questionText || 'Question',
        type: q?.type || safeQ?.type || 'MCQ',
        assertion: q?.assertion || safeQ?.assertion,
        reason: q?.reason || safeQ?.reason,
        options: q?.options || safeQ?.options || [],
        selectedOptionId: selected,
        studentAnswer: selected || 'UNANSWERED',
        correctAnswer: correctAns,
        isCorrect,
        isUnanswered,
        marksAwarded: isCorrect ? posMarks : isUnanswered ? 0 : -negMarks,
        explanation: test?.explanations?.[qId] || q?.explanation,
      };
    });
  },

  // Summaries of all submissions for teacher class view (scoped and authorized)
  getTestAttemptSummaries(testId: string, teacherId?: string, attemptsList?: TestAttempt[]): StudentAttemptSummary[] {
    const test = Storage.getTestById(testId, teacherId);
    if (teacherId && !test) return [];

    const attempts = attemptsList || Storage.getAttempts(testId, teacherId);
    const maxScore = (test?.totalQuestions || 40) * (test?.positiveMarks || 1);

    return attempts.map(att => {
      return {
        attemptId: att.id,
        studentId: att.studentId,
        studentName: att.studentName,
        studentEmail: att.studentEmail,
        studentRollNumber: att.studentRollNumber,
        testId: att.testId,
        attemptedCount: (att.correctCount || 0) + (att.incorrectCount || 0),
        correctCount: att.correctCount || 0,
        incorrectCount: att.incorrectCount || 0,
        unansweredCount:
          att.unansweredCount ??
          Math.max(0, (test?.totalQuestions || 40) - ((att.correctCount || 0) + (att.incorrectCount || 0))),
        score: att.score || 0,
        maxScore: att.maxScore || maxScore,
        percentage: att.percentage || 0,
        submittedAt: att.submittedAt || att.startedAt,
        status: att.status,
      };
    });
  },

  getAttemptsForTeacher(teacherId: string, attemptsList?: TestAttempt[]): TestAttempt[] {
    return attemptsList || Storage.getAttempts(undefined, teacherId);
  },
};

function shuffleArray<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function sampleRandom<T>(array: T[], count: number): T[] {
  const shuffled = shuffleArray(array);
  return shuffled.slice(0, Math.min(count, array.length));
}
