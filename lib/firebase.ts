'use client';

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import { getFirestore, initializeFirestore, type Firestore } from 'firebase/firestore';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

function getFirebaseConfig(): FirebaseConfig {
  return {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || '',
  };
}

export function isFirebaseConfigured() {
  const config = getFirebaseConfig();
  return Boolean(
    config.apiKey &&
      config.authDomain &&
      config.projectId &&
      config.storageBucket &&
      config.messagingSenderId &&
      config.appId,
  );
}

function assertFirebaseConfigured() {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }
}

let authPersistencePromise: Promise<void> | null = null;
let firestoreInstance: Firestore | null = null;

export function getFirebaseApp(): FirebaseApp {
  assertFirebaseConfigured();
  return getApps().length ? getApp() : initializeApp(getFirebaseConfig());
}

export function getFirebaseAuth(): Auth {
  const auth = getAuth(getFirebaseApp());

  if (!authPersistencePromise) {
    authPersistencePromise = setPersistence(auth, browserLocalPersistence).catch(() => undefined);
  }

  return auth;
}

export function waitForFirebaseAuthPersistence() {
  return authPersistencePromise ?? Promise.resolve();
}

export function createGoogleProvider() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return provider;
}

export function getFirestoreDb(): Firestore {
  if (!firestoreInstance) {
    const app = getFirebaseApp();

    try {
      firestoreInstance = initializeFirestore(app, {
        experimentalForceLongPolling: true,
      });
    } catch {
      firestoreInstance = getFirestore(app);
    }
  }

  return firestoreInstance;
}
