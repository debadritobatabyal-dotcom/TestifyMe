import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

export interface FirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

const firebaseConfig: FirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyArmydnqOIfAVYtevj_RK2Z6v9Z9AgX5wY',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'testifyme-5ddb1.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'testifyme-5ddb1',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'testifyme-5ddb1.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '803813527493',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:803813527493:web:d0fa48aff123833c4185ac',
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.apiKey !== 'YOUR_FIREBASE_API_KEY'
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    // Always initialize Firestore first so it is available regardless of auth state
    db = getFirestore(app);
    storage = getStorage(app);
    try {
      auth = getAuth(app);
      setPersistence(auth, browserLocalPersistence).catch(() => {});
    } catch (authErr) {
      console.warn('[TestifyMe] Firebase Auth setup notice:', authErr);
    }
    console.log('[TestifyMe] Connected to live Firebase Firestore instance.');
  } catch (error) {
    console.warn('[TestifyMe] Firebase initialization failed, falling back to local persistent store:', error);
  }
} else {
  console.log('[TestifyMe] Running with high-performance localized persistent store (Configure .env with Firebase credentials for cloud deployment).');
}

export { app, auth, db, storage };

