import { ClassAnalytics, QuestionAccuracyMetric, Question, TestAttempt, StudentSafeQuestion } from '../types';
import { Storage } from './storage';

export const AnalyticsService = {
  getClassAnalytics(testId: string, teacherId?: string, attemptsList?: TestAttempt[]): ClassAnalytics {
    const test = Storage.getTestById(testId, teacherId);
    if (teacherId && !test) {
      return {
        totalStudents: 0,
        totalSubmissions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        medianScore: 0,
        averagePercentage: 0,
        questionMetrics: [],
      };
    }

    const allAttempts = attemptsList || Storage.getAttempts(testId, teacherId);
    const attempts = allAttempts.filter(a => a.status === 'submitted');
    const students = Storage.getStudents();
    const allQuestions = Storage.getQuestions(teacherId);
    const qMap = new Map<string, Question>(allQuestions.map(q => [q.id, q]));
    const answerKeys = test?.answerKeys || {};
    const safeQMap = new Map<string, StudentSafeQuestion>(
      test?.questions ? test.questions.map(q => [q.id, q]) : []
    );

    if (attempts.length === 0) {
      return {
        totalStudents: students.length,
        totalSubmissions: 0,
        averageScore: 0,
        highestScore: 0,
        lowestScore: 0,
        medianScore: 0,
        averagePercentage: 0,
        questionMetrics: [],
      };
    }

    const scores = attempts.map(a => a.score ?? 0).sort((a, b) => a - b);
    const percentages = attempts.map(a => a.percentage ?? 0);

    const totalScoreSum = scores.reduce((sum, s) => sum + s, 0);
    const totalPctSum = percentages.reduce((sum, p) => sum + p, 0);

    const averageScore = Math.round((totalScoreSum / attempts.length) * 10) / 10;
    const averagePercentage = Math.round((totalPctSum / attempts.length) * 10) / 10;
    const highestScore = scores[scores.length - 1];
    const lowestScore = scores[0];

    // Median calculation
    const mid = Math.floor(scores.length / 2);
    const medianScore =
      scores.length % 2 !== 0 ? scores[mid] : Math.round(((scores[mid - 1] + scores[mid]) / 2) * 10) / 10;

    // Question Accuracy Metrics
    const questionStats = new Map<
      string,
      { attempts: number; correct: number; incorrect: number; unanswered: number }
    >();

    attempts.forEach(att => {
      att.questionIds.forEach(qId => {
        if (!questionStats.has(qId)) {
          questionStats.set(qId, { attempts: 0, correct: 0, incorrect: 0, unanswered: 0 });
        }
        const stat = questionStats.get(qId)!;
        stat.attempts++;

        const ans = att.answers[qId];
        const selected = ans?.selectedOptionId;
        const q = qMap.get(qId);
        const correctAns = answerKeys[qId] || q?.correctAnswer;

        if (!selected) {
          stat.unanswered++;
        } else if (correctAns && selected === correctAns) {
          stat.correct++;
        } else {
          stat.incorrect++;
        }
      });
    });

    const questionMetrics: QuestionAccuracyMetric[] = [];
    questionStats.forEach((stat, qId) => {
      const q = qMap.get(qId);
      const safeQ = safeQMap.get(qId);
      const accuracy = stat.attempts > 0 ? Math.round((stat.correct / stat.attempts) * 100) : 0;
      questionMetrics.push({
        questionId: qId,
        questionText: q?.questionText || safeQ?.questionText || 'Question',
        type: q?.type || safeQ?.type || 'MCQ',
        subject: q?.subject || safeQ?.subject || 'General',
        attempts: stat.attempts,
        correct: stat.correct,
        incorrect: stat.incorrect,
        unanswered: stat.unanswered,
        accuracy,
      });
    });

    // Sort questions by accuracy ascending (hardest questions first)
    questionMetrics.sort((a, b) => a.accuracy - b.accuracy);

    console.log(
      `[TEACHER_RESULTS] Analytics recalculated for test ${testId}: ${attempts.length} submissions, avg score ${averageScore}`
    );

    return {
      totalStudents: students.length,
      totalSubmissions: attempts.length,
      averageScore,
      highestScore,
      lowestScore,
      medianScore,
      averagePercentage,
      questionMetrics,
    };
  },

  // Scoped metrics for individual teacher overview dashboard (Requirement 6)
  getTeacherOverviewAnalytics(
    teacherId: string,
    attemptsList?: TestAttempt[]
  ): {
    totalTests: number;
    activeTests: number;
    scheduledTests: number;
    completedTests: number;
    totalQuestions: number;
    totalSubmissions: number;
    participatingStudents: number;
  } {
    const tests = Storage.getTests(teacherId);
    const questions = Storage.getQuestions(teacherId);
    const attempts = attemptsList || Storage.getAttempts(undefined, teacherId);
    const submittedAttempts = attempts.filter(a => a.status === 'submitted');
    const uniqueStudents = new Set(submittedAttempts.map(a => a.studentId));

    const now = Date.now();
    let activeTests = 0;
    let scheduledTests = 0;
    let completedTests = 0;

    tests.forEach(t => {
      if (t.status === 'draft') return;
      if (now < t.startTime) scheduledTests++;
      else if (now >= t.startTime && now <= t.endTime) activeTests++;
      else completedTests++;
    });

    return {
      totalTests: tests.length,
      activeTests,
      scheduledTests,
      completedTests,
      totalQuestions: questions.length,
      totalSubmissions: submittedAttempts.length,
      participatingStudents: uniqueStudents.size,
    };
  },
};
