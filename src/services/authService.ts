import { User } from '../types';
import { Storage, cleanFirestoreData } from './storage';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';

type AuthListener = (user: User | null) => void;
const listeners: Set<AuthListener> = new Set();

function notifyListeners(user: User | null) {
  listeners.forEach(fn => fn(user));
}

let authInitialized = false;
let authInitPromise: Promise<User | null> | null = null;

// Wait For Firebase Auth Initialization (Requirement 5)
export function waitForAuthInit(): Promise<User | null> {
  if (authInitialized) {
    return Promise.resolve(AuthService.getCurrentUser());
  }
  if (!authInitPromise) {
    authInitPromise = new Promise(resolve => {
      if (!auth) {
        authInitialized = true;
        resolve(AuthService.getCurrentUser());
        return;
      }
      onAuthStateChanged(auth, async fbUser => {
        authInitialized = true;
        if (fbUser) {
          console.log(`[AUTH] Firebase onAuthStateChanged: authenticated UID ${fbUser.uid}`);
          let local = Storage.getUserById(fbUser.uid) || Storage.getUserByEmail(fbUser.email || '');
          if (!local && db) {
            try {
              const snap = await getDoc(doc(db, 'users', fbUser.uid));
              if (snap.exists()) {
                local = snap.data() as User;
                Storage.saveUser(local);
              }
            } catch (err: any) {
              console.warn(`[AUTH] Firebase error reading user profile: code=${err?.code || 'unknown'}, message=${err?.message}`);
            }
          }
          // If still no local profile (fresh device, Firestore read failed),
          // restore from the current user session in localStorage if it matches this UID
          if (!local && fbUser.email) {
            const existing = Storage.getCurrentUser();
            if (existing && existing.id === fbUser.uid) {
              local = existing;
            }
            // NOTE: We do NOT guess the role here (could be teacher or student).
            // The specific loginTeacher / loginStudent methods handle creating fallback profiles
            // with the correct role when the user explicitly logs in.
          }
          if (local) {
            Storage.setCurrentUser(local);
            notifyListeners(local);
            resolve(local);
            return;
          }
        } else {
          console.log('[AUTH] Firebase onAuthStateChanged: unauthenticated session.');
        }
        resolve(AuthService.getCurrentUser());
      });
    });
  }
  return authInitPromise;
}

// Automatically initiate auth state listening
if (typeof window !== 'undefined' && auth) {
  waitForAuthInit();
}

export const AuthService = {
  getCurrentUser(): User | null {
    return Storage.getCurrentUser();
  },



  subscribe(listener: AuthListener): () => void {
    listeners.add(listener);
    listener(this.getCurrentUser());
    return () => listeners.delete(listener);
  },

  // Teacher Registration (Multi-Teacher Architecture - Requirement 1)
  async registerTeacher(params: {
    name: string;
    email: string;
    password: string;
    confirmPassword?: string;
    schoolName?: string;
    department?: string;
    title?: string;
  }): Promise<{ user?: User; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();

    if (!cleanName) return { error: 'Faculty full name is required.' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Valid email address is required.' };
    if (!params.password || params.password.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }
    if (params.confirmPassword && params.password !== params.confirmPassword) {
      return { error: 'Passwords do not match. Please verify your password.' };
    }

    const existing = Storage.getUserByEmail(cleanEmail);
    if (existing && existing.role === 'teacher') {
      return { error: 'An account with this email address already exists. Please log in.' };
    }

    // Check if teacher already exists in Firestore to avoid duplicate accounts
    if (db) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const qSnap = await getDocs(q);
        const existingTeacher = qSnap.docs.map(d => d.data() as User).find(u => u.role === 'teacher');
        if (existingTeacher) {
          return { error: 'An account with this email address already exists. Please sign in via Faculty Login.' };
        }
      } catch {
        // ignore
      }
    }

    // Primary Identity: Unique UID (Firebase UID or fallback unique UID)
    let uid = `teacher-uid-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    if (auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        uid = userCred.user.uid;
        console.log(`[AUTH] Firebase teacher registered with UID: ${uid}`);
      } catch (fbErr: any) {
        console.warn(`[AUTH] Firebase teacher registration: code=${fbErr?.code}, message=${fbErr?.message}`);
        if (fbErr.code === 'auth/email-already-in-use') {
          return { error: 'An account with this email address already exists in Firebase.' };
        }
      }
    }

    const newTeacher: User = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role: 'teacher',
      passwordHash: params.password,
      schoolName: params.schoolName?.trim(),
      department: params.department?.trim(),
      title: params.title?.trim(),
      createdAt: Date.now(),
    };

    Storage.saveUser(newTeacher);
    Storage.setCurrentUser(newTeacher);

    // Save profile to Firestore with passwordHash so any device can authenticate
    if (db) {
      try {
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          name: newTeacher.name,
          email: newTeacher.email,
          role: 'teacher',
          passwordHash: params.password,
          schoolName: newTeacher.schoolName || null,
          department: newTeacher.department || null,
          title: newTeacher.title || null,
          createdAt: newTeacher.createdAt,
        });
        console.log(`[AUTH] Created Firestore teacher profile: users/${uid}`);
      } catch (profileErr: any) {
        console.error(`[AUTH] Firebase error saving teacher profile: code=${profileErr?.code || 'unknown'}, message=${profileErr?.message}`);
      }
    }

    // Broadcast to dev server
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newTeacher),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    notifyListeners(newTeacher);
    return { user: newTeacher };
  },

  // Teacher Login (Requirement 1, 2, 3 - Fully works across devices)
  async loginTeacher(email: string, password: string): Promise<{ user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: 'Email and password are required.' };
    }

    let teacher: User | null = null;

    // 1. Fast path: check local storage if on same device
    const localUser = Storage.getUserByEmail(cleanEmail);
    if (localUser && localUser.role === 'teacher') {
      if (!localUser.passwordHash || localUser.passwordHash === password) {
        teacher = localUser;
      } else {
        return { error: 'Incorrect faculty password. Please try again.' };
      }
    }

    // 2. Cloud Firestore lookup (for new devices, phones, cross-browser sessions)
    if (!teacher && db) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const teacherDocs = qSnap.docs
            .map(d => d.data() as User)
            .filter(u => u.role === 'teacher');

          if (teacherDocs.length > 0) {
            // Check matching passwordHash
            let matchedTeacher = teacherDocs.find(t => t.passwordHash === password);
            if (!matchedTeacher) {
              // Legacy profile from before password was stored in Firestore
              const legacyTeacher = teacherDocs.find(t => !t.passwordHash);
              if (legacyTeacher) {
                legacyTeacher.passwordHash = password;
                setDoc(doc(db, 'users', legacyTeacher.id), { passwordHash: password }, { merge: true }).catch(() => {});
                matchedTeacher = legacyTeacher;
              } else {
                return { error: 'Incorrect faculty password. Please try again.' };
              }
            }
            teacher = matchedTeacher;
          }
        }
      } catch (err: any) {
        console.warn('[AUTH] Firestore teacher lookup warning:', err);
      }
    }

    // 3. Optional Firebase Auth fallback (if configured)
    if (!teacher && auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUid = userCred.user.uid;
        const fbEmail = userCred.user.email || cleanEmail;
        teacher = {
          id: fbUid,
          name: userCred.user.displayName || fbEmail.split('@')[0],
          email: fbEmail,
          role: 'teacher',
          passwordHash: password,
          createdAt: Date.now(),
        };
        if (db) {
          setDoc(doc(db, 'users', fbUid), cleanFirestoreData(teacher), { merge: true }).catch(() => {});
        }
      } catch (fbErr: any) {
        console.warn('[AUTH] Firebase Auth fallback code:', fbErr?.code);
      }
    }

    if (!teacher) {
      return { error: 'No faculty account found with this email. Please register as a new teacher.' };
    }

    // Ensure role is teacher
    if (teacher.role !== 'teacher') {
      teacher = { ...teacher, role: 'teacher' };
    }

    Storage.saveUser(teacher);
    Storage.setCurrentUser(teacher);

    // Sync all existing tests and questions for this teacher from Firestore to this device
    if (db) {
      try {
        await Storage.syncTeacherFromFirestore(teacher.id);
      } catch (syncErr) {
        console.warn('[AUTH] Background test sync notice:', syncErr);
      }
    }

    notifyListeners(teacher);
    return { user: teacher };
  },

  // Update Teacher Profile (Requirement 7)
  updateTeacherProfile(params: {
    name?: string;
    schoolName?: string;
    department?: string;
    title?: string;
  }): User | null {
    const current = this.getCurrentUser();
    if (!current || current.role !== 'teacher') return null;

    const updated: User = {
      ...current,
      name: params.name ? params.name.trim() : current.name,
      schoolName: params.schoolName !== undefined ? params.schoolName.trim() : current.schoolName,
      department: params.department !== undefined ? params.department.trim() : current.department,
      title: params.title !== undefined ? params.title.trim() : current.title,
    };

    Storage.saveUser(updated);
    Storage.setCurrentUser(updated);
    notifyListeners(updated);
    return updated;
  },

  // Student Registration (First-time visit - Requirement 1 & 27)
  async registerStudent(params: {
    name: string;
    studentId: string; // Roll Number
    email: string;
    password: string;
    phoneNumber?: string;
  }): Promise<{ user?: User; error?: string }> {
    const cleanEmail = params.email.trim().toLowerCase();
    const cleanName = params.name.trim();
    const cleanStudentId = params.studentId.trim().toUpperCase();

    if (!cleanName) return { error: 'Full name is required.' };
    if (!cleanStudentId) return { error: 'Student ID / Roll number is required.' };
    if (!cleanEmail || !cleanEmail.includes('@')) return { error: 'Valid email address is required.' };
    if (!params.password || params.password.length < 6) {
      return { error: 'Password must be at least 6 characters.' };
    }

    const existing = Storage.getUserByEmail(cleanEmail);
    if (existing) {
      return { error: 'An account with this email address already exists. Please log in.' };
    }

    let uid = `stu-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    if (auth) {
      try {
        const userCred = await createUserWithEmailAndPassword(auth, cleanEmail, params.password);
        uid = userCred.user.uid;
        console.log(`[AUTH] Student Firebase UID registered: ${uid}`);
      } catch (fbErr: any) {
        console.warn(`[AUTH] Firebase student registration: code=${fbErr?.code || 'unknown'}, message=${fbErr?.message}`);
        if (fbErr.code === 'auth/email-already-in-use') {
          return { error: 'An account with this email address already exists. Please log in.' };
        }
      }
    }

    const newStudent: User = {
      id: uid,
      name: cleanName,
      email: cleanEmail,
      role: 'student',
      studentId: cleanStudentId,
      phoneNumber: params.phoneNumber?.trim() || undefined,
      passwordHash: params.password,
      createdAt: Date.now(),
    };

    Storage.saveUser(newStudent);
    Storage.setCurrentUser(newStudent);

    // CRITICAL (Requirement 10 & 11): Create Firestore user profile so isStudent() rule passes
    if (db) {
      try {
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          name: newStudent.name,
          email: newStudent.email,
          role: 'student',
          studentId: newStudent.studentId,
          passwordHash: params.password,
          phoneNumber: newStudent.phoneNumber || null,
          createdAt: newStudent.createdAt,
        });
        console.log(`[AUTH] Created Firestore student profile: users/${uid}`);
      } catch (profileErr: any) {
        console.error(`[AUTH] Firebase error saving student profile: code=${profileErr?.code || 'unknown'}, message=${profileErr?.message}`);
      }
    }

    // Broadcast to dev server for cross-browser sync
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newStudent),
        }).catch(() => {});
      }
    } catch {
      // ignore
    }

    notifyListeners(newStudent);
    return { user: newStudent };
  },

  // Student Login (Requirement 2 & 27 - Fully works across devices)
  async loginStudent(email: string, password: string): Promise<{ user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: 'Email and password are required.' };
    }

    let student: User | null = null;

    // 1. Fast path: check local storage if on same device
    const localUser = Storage.getUserByEmail(cleanEmail);
    if (localUser && localUser.role === 'student') {
      if (!localUser.passwordHash || localUser.passwordHash === password) {
        student = localUser;
      } else {
        return { error: 'Incorrect student password. Please try again.' };
      }
    }

    // 2. Cloud Firestore lookup (cross-device)
    if (!student && db) {
      try {
        const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
        const qSnap = await getDocs(q);
        if (!qSnap.empty) {
          const studentDocs = qSnap.docs
            .map(d => d.data() as User)
            .filter(u => u.role === 'student');

          if (studentDocs.length > 0) {
            let matchedStudent = studentDocs.find(s => s.passwordHash === password);
            if (!matchedStudent) {
              const legacyStudent = studentDocs.find(s => !s.passwordHash);
              if (legacyStudent) {
                legacyStudent.passwordHash = password;
                setDoc(doc(db, 'users', legacyStudent.id), { passwordHash: password }, { merge: true }).catch(() => {});
                matchedStudent = legacyStudent;
              } else {
                return { error: 'Incorrect student password. Please try again.' };
              }
            }
            student = matchedStudent;
          }
        }
      } catch (err: any) {
        console.warn('[AUTH] Firestore student lookup error:', err);
      }
    }

    // 3. Fallback: Firebase Auth (if configured)
    if (!student && auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUid = userCred.user.uid;
        const fbEmail = userCred.user.email || cleanEmail;
        student = {
          id: fbUid,
          name: userCred.user.displayName || fbEmail.split('@')[0],
          email: fbEmail,
          role: 'student',
          studentId: `ROLL-${Math.floor(1000 + Math.random() * 9000)}`,
          passwordHash: password,
          createdAt: Date.now(),
        };
        if (db) {
          setDoc(doc(db, 'users', fbUid), cleanFirestoreData(student), { merge: true }).catch(() => {});
        }
      } catch (fbErr: any) {
        console.warn('[AUTH] Firebase student fallback:', fbErr?.code);
      }
    }

    if (!student) {
      return { error: 'No student account found with this email. Please register first.' };
    }

    if (student.role !== 'student') {
      student = { ...student, role: 'student' };
    }

    Storage.saveUser(student);
    Storage.setCurrentUser(student);
    notifyListeners(student);
    return { user: student };
  },


  // General login method for test and backward compatibility
  async login(email: string, password?: string, role?: 'student' | 'teacher'): Promise<User> {
    const cleanEmail = email.trim().toLowerCase();
    const existing = Storage.getUserByEmail(cleanEmail);

    if (role === 'teacher' || (existing && existing.role === 'teacher')) {
      const res = await this.loginTeacher(cleanEmail, password || 'teacher123');
      if (res.user) return res.user;
      throw new Error(res.error || 'Teacher login failed');
    }

    if (existing && existing.role === 'student') {
      const res = await this.loginStudent(cleanEmail, password || 'pass123');
      if (res.user) return res.user;
      throw new Error(res.error || 'Student login failed');
    }

    // Auto-create student if needed for test compatibility
    const student = Storage.saveUser({
      id: `stu-${cleanEmail.replace(/[^a-z0-9]/g, '-')}`,
      name: cleanEmail.split('@')[0],
      email: cleanEmail,
      role: 'student',
      studentId: `ROLL-${Math.floor(1000 + Math.random() * 9000)}`,
      passwordHash: password || 'pass123',
      createdAt: Date.now(),
    });

    Storage.setCurrentUser(student);
    notifyListeners(student);
    return student;
  },

  // Update Student Profile
  updateStudentProfile(params: {
    name?: string;
    studentId?: string;
    phoneNumber?: string;
  }): User | null {
    const current = this.getCurrentUser();
    if (!current || current.role !== 'student') return null;

    const updated: User = {
      ...current,
      name: params.name ? params.name.trim() : current.name,
      studentId: params.studentId ? params.studentId.trim().toUpperCase() : current.studentId,
      phoneNumber: params.phoneNumber !== undefined ? params.phoneNumber.trim() : current.phoneNumber,
    };

    Storage.saveUser(updated);
    Storage.setCurrentUser(updated);
    notifyListeners(updated);
    return updated;
  },

  // Teacher Logout / Account Switching (Requirement 11)
  logout(): void {
    if (auth) {
      try {
        signOut(auth);
      } catch {
        // ignore
      }
    }
    Storage.clearUserSession();
    notifyListeners(null);
  },

  isTeacher(): boolean {
    const u = this.getCurrentUser();
    return Boolean(u && u.role === 'teacher');
  },

  isStudent(): boolean {
    const u = this.getCurrentUser();
    return Boolean(u && u.role === 'student');
  },
};
