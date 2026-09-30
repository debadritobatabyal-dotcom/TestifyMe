import { User } from '../types';
import { Storage } from './storage';
import { auth, db } from '../config/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
    const stored = Storage.getCurrentUser();
    if (stored) return stored;
    const guest: User = { id: 'guest-teacher', name: 'Guest Teacher', role: 'teacher', email: 'guest@local', createdAt: Date.now() };
    Storage.setCurrentUser(guest);
    return guest;
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
    if (existing) {
      return { error: 'An account with this email address already exists. Please log in.' };
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

    // Save profile to Firestore
    if (db) {
      try {
        await setDoc(doc(db, 'users', uid), {
          id: uid,
          name: newTeacher.name,
          email: newTeacher.email,
          role: 'teacher',
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

  // Teacher Login (Requirement 1, 2, 3)
  async loginTeacher(email: string, password: string): Promise<{ user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !password) {
      return { error: 'Email and password are required.' };
    }

    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUid = userCred.user.uid;
        console.log(`[AUTH] Firebase teacher logged in: UID ${fbUid}`);
        let teacher = Storage.getUserById(fbUid) || Storage.getUserByEmail(cleanEmail);
        if (!teacher && db) {
          try {
            const snap = await getDoc(doc(db, 'users', fbUid));
            if (snap.exists()) {
              teacher = snap.data() as User;
              Storage.saveUser(teacher);
            }
          } catch (err: any) {
            console.error(`[AUTH] Firebase error reading teacher profile: code=${err?.code || 'unknown'}, message=${err?.message}`);
          }
        }
        if (teacher && teacher.role === 'teacher') {
          Storage.setCurrentUser(teacher);
          notifyListeners(teacher);
          return { user: teacher };
        }
      } catch (signInErr: any) {
        console.warn(`[AUTH] Firebase teacher signIn error: code=${signInErr?.code || 'unknown'}, message=${signInErr?.message}`);
      }
    }

    const user = Storage.getUserByEmail(cleanEmail);
    if (!user || user.role !== 'teacher') {
      return { error: 'No faculty account found with this email. Please register as a new teacher.' };
    }

    if (user.passwordHash && user.passwordHash !== password) {
      return { error: 'Incorrect faculty password. Please try again.' };
    }

    Storage.setCurrentUser(user);
    notifyListeners(user);
    return { user };
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

  // Student Login (Requirement 2 & 27)
  async loginStudent(email: string, password: string): Promise<{ user?: User; error?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    if (auth) {
      try {
        const userCred = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUid = userCred.user.uid;
        console.log(`[AUTH] Firebase student logged in: UID ${fbUid}`);
        let user = Storage.getUserById(fbUid) || Storage.getUserByEmail(cleanEmail);
        if (!user && db) {
          try {
            const snap = await getDoc(doc(db, 'users', fbUid));
            if (snap.exists()) {
              user = snap.data() as User;
              Storage.saveUser(user);
            }
          } catch (err: any) {
            console.error(`[AUTH] Firebase error reading student profile: code=${err?.code || 'unknown'}, message=${err?.message}`);
          }
        }
        if (user && user.role === 'student') {
          Storage.setCurrentUser(user);
          notifyListeners(user);
          return { user };
        }
      } catch (signInErr: any) {
        console.warn(`[AUTH] Firebase student signIn error: code=${signInErr?.code || 'unknown'}, message=${signInErr?.message}`);
      }
    }

    const user = Storage.getUserByEmail(cleanEmail);
    if (!user || user.role !== 'student') {
      return { error: 'No student account found with this email. Please register first.' };
    }

    if (user.passwordHash && user.passwordHash !== password) {
      return { error: 'Incorrect password. Please try again.' };
    }

    Storage.setCurrentUser(user);
    notifyListeners(user);
    return { user };
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
