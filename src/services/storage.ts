import { Question, Test, TestAttempt, User, PublicTestAccess } from '../types';
import { db } from '../config/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const KEYS = {
  QUESTIONS: 'testifyme_questions_prod_v2',
  TESTS: 'testifyme_tests_prod_v2',
  ATTEMPTS: 'testifyme_attempts_prod_v2',
  CURRENT_USER: 'testifyme_current_user_prod_v2',
  USERS: 'testifyme_users_prod_v2',
  PUBLIC_TESTS: 'testifyme_public_tests_prod_v2',
};

const memoryStore = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.getItem === 'function') {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch {
      // fallback in memory
    }
    return memoryStore.get(key) || null;
  },

  setItem(key: string, value: string): void {
    memoryStore.set(key, value);
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.setItem === 'function') {
        window.localStorage.setItem(key, value);
      }
    } catch {
      // ignore
    }
  },

  removeItem(key: string): void {
    memoryStore.delete(key);
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.removeItem === 'function') {
        window.localStorage.removeItem(key);
      }
    } catch {
      // ignore
    }
  },

  clear(): void {
    memoryStore.clear();
    try {
      if (typeof window !== 'undefined' && window.localStorage && typeof window.localStorage.clear === 'function') {
        window.localStorage.clear();
      }
    } catch {
      // ignore
    }
  },
};

// Initialize system with clean production state (Requirement 10: 0 fake tests, 0 fake submissions)
function initializeSystem() {
  if (!safeStorage.getItem(KEYS.USERS)) {
    safeStorage.setItem(KEYS.USERS, JSON.stringify([]));
  }
  if (!safeStorage.getItem(KEYS.QUESTIONS)) {
    safeStorage.setItem(KEYS.QUESTIONS, JSON.stringify([]));
  }
  if (!safeStorage.getItem(KEYS.TESTS)) {
    safeStorage.setItem(KEYS.TESTS, JSON.stringify([]));
  }
  if (!safeStorage.getItem(KEYS.ATTEMPTS)) {
    safeStorage.setItem(KEYS.ATTEMPTS, JSON.stringify([]));
  }
}

initializeSystem();

export const Storage = {
  // Clear full user session on logout (Requirement 11)
  clearUserSession(): void {
    this.setCurrentUser(null);
  },

  // Questions - Isolated per Teacher UID (Requirement 2 & 4)
  getQuestions(teacherId?: string): Question[] {
    try {
      const data = safeStorage.getItem(KEYS.QUESTIONS);
      const list: Question[] = data ? JSON.parse(data) : [];
      if (teacherId) {
        return list.filter(q => q.ownerId === teacherId);
      }
      return list;
    } catch {
      return [];
    }
  },

  saveQuestions(questions: Question[]): void {
    safeStorage.setItem(KEYS.QUESTIONS, JSON.stringify(questions));
  },

  addQuestion(question: Question, teacherId?: string): Question {
    const list = this.getQuestions();
    const ownerId = teacherId || question.ownerId;
    const qWithOwnership: Question = { ...question, ownerId };

    const existingIndex = list.findIndex(q => q.id === question.id);
    if (existingIndex >= 0) {
      // Authorization check: must own question to update
      if (teacherId && list[existingIndex].ownerId && list[existingIndex].ownerId !== teacherId) {
        throw new Error('Permission denied: You do not own this question.');
      }
      list[existingIndex] = qWithOwnership;
    } else {
      list.unshift(qWithOwnership);
    }
    this.saveQuestions(list);
    return qWithOwnership;
  },

  addQuestionsBulk(questions: Question[], teacherId: string): number {
    const list = this.getQuestions();
    const existingIds = new Set(list.map(q => q.id));
    let added = 0;
    questions.forEach(q => {
      if (!existingIds.has(q.id)) {
        list.push({ ...q, ownerId: teacherId });
        existingIds.add(q.id);
        added++;
      }
    });
    this.saveQuestions(list);
    return added;
  },

  deleteQuestion(id: string, teacherId?: string): boolean {
    const list = this.getQuestions();
    const target = list.find(q => q.id === id);
    if (!target) return false;

    // Authorization check
    if (teacherId && target.ownerId && target.ownerId !== teacherId) {
      throw new Error('Permission denied: You do not have permission to delete this question.');
    }

    const updated = list.filter(q => q.id !== id);
    this.saveQuestions(updated);
    return true;
  },

  resetQuestionsToDefault(): Question[] {
    return [];
  },

  // Public Tests Registry (Safe metadata for student link resolution)
  getPublicTests(): PublicTestAccess[] {
    try {
      const data = safeStorage.getItem(KEYS.PUBLIC_TESTS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  savePublicTest(pub: PublicTestAccess): void {
    const list = this.getPublicTests();
    const cleanCode = (pub.testCode || pub.accessCode).trim().toUpperCase();
    const sanitized: PublicTestAccess = {
      ...pub,
      testCode: cleanCode,
      accessCode: cleanCode,
      name: pub.name || pub.title || 'Examination',
      title: pub.title || pub.name || 'Examination',
    };
    const idx = list.findIndex(p => p.testCode === cleanCode || p.testId === pub.testId);
    if (idx >= 0) {
      list[idx] = sanitized;
    } else {
      list.unshift(sanitized);
    }
    safeStorage.setItem(KEYS.PUBLIC_TESTS, JSON.stringify(list));
  },

  // Tests - Strictly Scoped to Authenticated Teacher UID (Requirements 2, 3, 4, 9, 13)
  getTests(teacherId?: string): Test[] {
    try {
      const data = safeStorage.getItem(KEYS.TESTS);
      const list: Test[] = data ? JSON.parse(data) : [];
      // Normalize all existing and newly loaded tests (Requirement 14: backward compatibility)
      const normalized = list.map(t => {
        const code = (t.testCode || t.accessCode || '').trim().toUpperCase();
        return {
          ...t,
          testCode: code,
          accessCode: code,
          isPublished: t.isPublished !== undefined ? t.isPublished : t.status !== 'draft',
        };
      });

      if (teacherId) {
        return normalized.filter(t => t.ownerId === teacherId || t.createdBy === teacherId);
      }
      return normalized;
    } catch {
      return [];
    }
  },

  getTestById(id: string, teacherId?: string): Test | undefined {
    const all = this.getTests();
    const test = all.find(t => t.id === id);
    if (!test) return undefined;

    // If teacher context is specified, verify ownership authorization
    if (teacherId && test.ownerId !== teacherId && test.createdBy !== teacherId) {
      return undefined; // Denied: Teacher B cannot see Teacher A's test
    }
    return test;
  },

  // Explicit security-checked test retrieval for API/routing level (Requirement 5 & 14)
  getAuthorizedTestById(
    id: string,
    teacherId: string
  ): { test?: Test; error?: string } {
    const all = this.getTests();
    const test = all.find(t => t.id === id);
    if (!test) {
      return { error: 'Test not found.' };
    }
    if (test.ownerId !== teacherId && test.createdBy !== teacherId) {
      return {
        error: 'Permission denied: You do not have authorization to access tests owned by another educator.',
      };
    }
    return { test };
  },

  // Test Code Lookup - Standard Public Access Identifier (Requirements 2, 3, 4, 6, 8)
  getTestByAccessCode(code: string): Test | undefined {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return undefined;

    // 1. Check local tests store
    const all = this.getTests();
    const found = all.find(
      t =>
        (t.testCode && t.testCode.toUpperCase() === cleanCode) ||
        (t.accessCode && t.accessCode.toUpperCase() === cleanCode) ||
        t.id.toUpperCase() === cleanCode
    );
    if (found) return found;

    // 2. Check public tests metadata store
    const publicTests = this.getPublicTests();
    const pub = publicTests.find(
      p =>
        (p.testCode && p.testCode.toUpperCase() === cleanCode) ||
        (p.accessCode && p.accessCode.toUpperCase() === cleanCode) ||
        p.testId.toUpperCase() === cleanCode
    );

    if (pub) {
      return {
        id: pub.testId,
        ownerId: pub.ownerId,
        createdBy: pub.ownerId,
        name: pub.name || pub.title || 'Examination',
        description: pub.description || '',
        durationMinutes: pub.durationMinutes || 40,
        startTime: pub.startTime,
        endTime: pub.endTime,
        totalQuestions: pub.totalQuestions || 40,
        assertionReasonCount: pub.assertionReasonCount || 5,
        mcqCount: pub.mcqCount || 35,
        positiveMarks: pub.positiveMarks || 1,
        negativeMarkingEnabled: pub.negativeMarkingEnabled ?? true,
        negativeMarks: pub.negativeMarks ?? 0.25,
        negativeMarking: pub.negativeMarks ?? 0.25,
        allowUnanswered: true,
        randomizeQuestions: true,
        randomizeOptions: true,
        maxAttempts: 1,
        accessCode: cleanCode,
        testCode: cleanCode,
        status: pub.status,
        isPublished: pub.isPublished,
        createdAt: pub.createdAt,
      };
    }

    return undefined;
  },

  // Asynchronous resolution supporting cross-tab, cross-window (incognito), Safari, and Firebase cloud lookup
  async resolveTestByCode(code: string): Promise<Test | undefined> {
    const cleanCode = (code || '').trim().toUpperCase();
    if (!cleanCode) return undefined;

    // 1. Fast path: check synchronous memory/localStorage
    const local = this.getTestByAccessCode(cleanCode);
    if (local && local.questions && local.questions.length > 0) return local;

    // 2. Local dev server sync API for cross-browser / separate incognito / Safari
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const fullRes = await fetch(`/api/tests/code/${encodeURIComponent(cleanCode)}`);
        const fullContentType = fullRes.headers?.get('content-type') || '';
        if (fullRes.ok && fullContentType.includes('application/json')) {
          const fullTest: Test = await fullRes.json();
          if (fullTest && fullTest.id) {
            this.saveTest(fullTest);
            return fullTest;
          }
        }

        const res = await fetch(`/api/test-access/${encodeURIComponent(cleanCode)}`);
        const resContentType = res.headers?.get('content-type') || '';
        if (res.ok && resContentType.includes('application/json')) {
          const pub: PublicTestAccess = await res.json();
          if (pub && (pub.testCode || pub.accessCode)) {
            this.savePublicTest(pub);
            if (pub.testId) {
              const testRes = await fetch(`/api/tests/${encodeURIComponent(pub.testId)}`);
              const testContentType = testRes.headers?.get('content-type') || '';
              if (testRes.ok && testContentType.includes('application/json')) {
                const fetchedTest: Test = await testRes.json();
                if (fetchedTest && fetchedTest.id) {
                  this.saveTest(fetchedTest);
                  return fetchedTest;
                }
              }
            }
            return this.getTestByAccessCode(cleanCode);
          }
        }
      }
    } catch {
      // Dev server fetch failed, continue to Firestore
    }

    // 3. Cloud Firestore resolution (if configured)
    if (db) {
      try {
        const docSnap = await getDoc(doc(db, 'testAccess', cleanCode));
        if (docSnap.exists()) {
          const pub = docSnap.data() as PublicTestAccess;
          if (pub) {
            this.savePublicTest(pub);
            if (pub.testId) {
              try {
                const testSnap = await getDoc(doc(db, 'tests', pub.testId));
                if (testSnap.exists()) {
                  const fullTest = testSnap.data() as Test;
                  this.saveTest(fullTest);
                  return fullTest;
                }
              } catch (testErr: any) {
                console.warn(`[TEST] Firestore test fetch error: code=${testErr?.code}, message=${testErr?.message}`);
              }
            }
            return this.getTestByAccessCode(cleanCode);
          }
        }
      } catch (err: any) {
        console.warn(`[TEST] Cloud Firestore test resolution error: code=${err?.code}, message=${err?.message}`);
      }
    }

    return local || undefined;
  },

  saveTests(tests: Test[]): void {
    const normalized = tests.map(t => {
      const code = (t.testCode || t.accessCode || '').trim().toUpperCase();
      return {
        ...t,
        testCode: code,
        accessCode: code,
        isPublished: t.isPublished !== undefined ? t.isPublished : t.status !== 'draft',
      };
    });
    safeStorage.setItem(KEYS.TESTS, JSON.stringify(normalized));
  },

  saveTest(test: Test, teacherId?: string): Test {
    const list = this.getTests();
    const ownerId = teacherId || test.ownerId || test.createdBy;
    const testCode = (test.testCode || test.accessCode || '').trim().toUpperCase();

    const testWithOwnership: Test = {
      ...test,
      ownerId,
      createdBy: ownerId,
      testCode,
      accessCode: testCode,
      isPublished: test.isPublished !== undefined ? test.isPublished : test.status !== 'draft',
    };

    const idx = list.findIndex(t => t.id === test.id);
    if (idx >= 0) {
      // Authorization check: must be owner to update
      if (teacherId && list[idx].ownerId !== teacherId && list[idx].createdBy !== teacherId) {
        throw new Error('Permission denied: You cannot edit another teacher\'s test.');
      }
      list[idx] = testWithOwnership;
    } else {
      list.unshift(testWithOwnership);
    }
    this.saveTests(list);

    // Save public access metadata representation
    const publicAccess: PublicTestAccess = {
      testId: testWithOwnership.id,
      testCode,
      accessCode: testCode,
      name: testWithOwnership.name,
      title: testWithOwnership.name,
      description: testWithOwnership.description,
      status: testWithOwnership.status,
      durationMinutes: testWithOwnership.durationMinutes,
      startTime: testWithOwnership.startTime,
      endTime: testWithOwnership.endTime,
      totalQuestions: testWithOwnership.totalQuestions,
      assertionReasonCount: testWithOwnership.assertionReasonCount,
      mcqCount: testWithOwnership.mcqCount,
      positiveMarks: testWithOwnership.positiveMarks,
      negativeMarkingEnabled: testWithOwnership.negativeMarkingEnabled,
      negativeMarks: testWithOwnership.negativeMarks,
      negativeMarking: testWithOwnership.negativeMarking,
      isPublished: testWithOwnership.isPublished ?? (testWithOwnership.status !== 'draft'),
      ownerId,
      createdAt: testWithOwnership.createdAt,
    };
    this.savePublicTest(publicAccess);

    // Broadcast sync to local dev server if available
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        fetch('/api/test-access', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(publicAccess),
        }).catch(() => {});

        fetch('/api/test-sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tests: [testWithOwnership] }),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    // Save to live Cloud Firestore if configured
    if (db) {
      try {
        setDoc(doc(db, 'testAccess', testCode), publicAccess, { merge: true }).catch(() => {});
        setDoc(doc(db, 'tests', testWithOwnership.id), testWithOwnership, { merge: true }).catch(() => {});
      } catch (err) {
        console.warn('[TestifyMe] Firestore sync error:', err);
      }
    }

    return testWithOwnership;
  },

  deleteTest(id: string, teacherId?: string): boolean {
    const list = this.getTests();
    const target = list.find(t => t.id === id);
    if (!target) return false;

    // Authorization check
    if (teacherId && target.ownerId !== teacherId && target.createdBy !== teacherId) {
      throw new Error('Permission denied: You cannot delete another teacher\'s test.');
    }

    const updated = list.filter(t => t.id !== id);
    this.saveTests(updated);

    // Also delete associated attempts
    const attempts = this.getAttempts().filter(a => a.testId !== id);
    safeStorage.setItem(KEYS.ATTEMPTS, JSON.stringify(attempts));

    // Also delete public test metadata
    const publicTests = this.getPublicTests().filter(p => p.testId !== id && p.testCode !== target.testCode);
    safeStorage.setItem(KEYS.PUBLIC_TESTS, JSON.stringify(publicTests));
    return true;
  },

  // Attempts - Scoped by Test and Teacher (Requirement 2 & 8)
  getAttempts(testId?: string, teacherId?: string): TestAttempt[] {
    try {
      const data = safeStorage.getItem(KEYS.ATTEMPTS);
      let attempts: TestAttempt[] = data ? JSON.parse(data) : [];

      if (teacherId) {
        const teacherTestIds = new Set(this.getTests(teacherId).map(t => t.id));
        attempts = attempts.filter(
          a => (a.ownerId && a.ownerId === teacherId) || teacherTestIds.has(a.testId)
        );
      }

      if (testId) {
        return attempts.filter(a => a.testId === testId);
      }
      return attempts;
    } catch {
      return [];
    }
  },

  getAttemptById(id: string): TestAttempt | undefined {
    return this.getAttempts().find(a => a.id === id);
  },

  getStudentAttemptForTest(studentId: string, testId: string): TestAttempt | undefined {
    const deterministicId = `att-${testId}-${studentId}`;
    return this.getAttempts().find(
      a => (a.studentId === studentId && a.testId === testId) || a.id === deterministicId
    );
  },

  async resolveStudentAttempt(studentId: string, testId: string): Promise<TestAttempt | undefined> {
    const local = this.getStudentAttemptForTest(studentId, testId);
    if (local) return local;

    const deterministicId = `att-${testId}-${studentId}`;
    // 1. Try dev server
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const res = await fetch(`/api/attempts/${encodeURIComponent(deterministicId)}`);
        const contentType = res.headers?.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const remoteAttempt = await res.json();
          if (remoteAttempt && remoteAttempt.id) {
            this.saveAttempt(remoteAttempt);
            return remoteAttempt;
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Try Firestore
    if (db) {
      try {
        const snap = await getDoc(doc(db, 'attempts', deterministicId));
        if (snap.exists()) {
          const remoteAttempt = snap.data() as TestAttempt;
          this.saveAttempt(remoteAttempt);
          return remoteAttempt;
        }
      } catch (err: any) {
        console.warn(`[ATTEMPT] Firestore fetch attempt error: code=${err?.code}, message=${err?.message}`);
      }
    }

    return undefined;
  },

  saveAttempt(attempt: TestAttempt, shouldSync: boolean = true): TestAttempt {
    // Automatically attach test ownerId if not present
    let ownerId = attempt.ownerId;
    if (!ownerId) {
      const test = this.getTests().find(t => t.id === attempt.testId);
      if (test) ownerId = test.ownerId;
    }

    const attemptWithOwnership: TestAttempt = { ...attempt, ownerId };
    const attempts = this.getAttempts();
    const idx = attempts.findIndex(a => a.id === attempt.id);
    if (idx >= 0) {
      attempts[idx] = attemptWithOwnership;
    } else {
      attempts.unshift(attemptWithOwnership);
    }
    safeStorage.setItem(KEYS.ATTEMPTS, JSON.stringify(attempts));

    if (shouldSync) {
      // Broadcast sync to local dev server if available
      try {
        if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
          fetch('/api/attempts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attemptWithOwnership),
          }).catch(() => {});
        }
      } catch {
        // ignore
      }

      // Live Cloud Firestore sync (Requirement 7 & 8)
      if (db) {
        setDoc(doc(db, 'attempts', attemptWithOwnership.id), attemptWithOwnership, { merge: true })
          .then(() => {
            console.log(`[ATTEMPT] Synced to Firestore: attempts/${attemptWithOwnership.id}`);
          })
          .catch((err: any) => {
            console.error(
              `[ATTEMPT] Firebase error saving attempt: code=${err?.code || 'unknown'}, message=${err?.message}`
            );
          });
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('testifyme_attempt_updated', { detail: attemptWithOwnership }));
      }
    }

    return attemptWithOwnership;
  },

  async saveAttemptAsync(attempt: TestAttempt): Promise<TestAttempt> {
    const saved = this.saveAttempt(attempt, false);

    // Sync to dev server
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        await fetch('/api/attempts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saved),
        });
      }
    } catch {
      // ignore
    }

    // Sync to Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'attempts', saved.id), saved, { merge: true });
        console.log(`[ATTEMPT] Successfully written to Firestore: attempts/${saved.id}`);
      } catch (err: any) {
        console.error(
          `[ATTEMPT] Firebase error saving attempt: code=${err?.code || 'unknown'}, message=${err?.message}`
        );
        throw err;
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('testifyme_attempt_updated', { detail: saved }));
    }

    return saved;
  },

  // Users & Profiles
  getUsers(): User[] {
    try {
      const data = safeStorage.getItem(KEYS.USERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  },

  getTeachers(): User[] {
    return this.getUsers().filter(u => u.role === 'teacher');
  },

  getStudents(): User[] {
    return this.getUsers().filter(u => u.role === 'student');
  },

  getUserById(id: string): User | undefined {
    return this.getUsers().find(u => u.id === id);
  },

  getUserByEmail(email: string): User | undefined {
    const clean = email.trim().toLowerCase();
    return this.getUsers().find(u => u.email.toLowerCase() === clean);
  },

  saveUser(user: User): User {
    const users = this.getUsers();
    const idx = users.findIndex(
      u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase()
    );
    if (idx >= 0) {
      users[idx] = { ...users[idx], ...user };
    } else {
      users.push(user);
    }
    safeStorage.setItem(KEYS.USERS, JSON.stringify(users));
    return user;
  },

  getCurrentUser(): User | null {
    try {
      const data = safeStorage.getItem(KEYS.CURRENT_USER);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  setCurrentUser(user: User | null): void {
    if (user) {
      safeStorage.setItem(KEYS.CURRENT_USER, JSON.stringify(user));
    } else {
      safeStorage.removeItem(KEYS.CURRENT_USER);
    }
  },
};
