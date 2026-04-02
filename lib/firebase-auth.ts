'use client';

import type { FirebaseError } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  type User as FirebaseAuthUser,
  updateProfile,
} from 'firebase/auth';
import { createGoogleProvider, getFirebaseAuth, isFirebaseConfigured, waitForFirebaseAuthPersistence } from '@/lib/firebase';
import type { AuthMode, UserRole } from '@/lib/db';

const AUTH_REDIRECT_INTENT_KEY = 'firebase_google_auth_intent';

export interface FirebaseGoogleProfile {
  uid: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface FirebasePasswordAuthProfile {
  uid: string;
  email: string;
  name: string;
}

export interface FirebaseGoogleAuthIntent {
  role: UserRole;
  mode: AuthMode;
  accessCode?: string;
}

type FirebaseAuthProvider = 'google' | 'password';

function mapFirebaseUser(user: FirebaseAuthUser): FirebaseGoogleProfile {
  if (!user.email) {
    throw new Error('Firebase did not return a Google email address.');
  }

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || user.email.split('@')[0],
    avatarUrl: user.photoURL || undefined,
  };
}

function mapPasswordFirebaseUser(user: FirebaseAuthUser, fallbackName?: string): FirebasePasswordAuthProfile {
  if (!user.email) {
    throw new Error('Firebase did not return an email address.');
  }

  return {
    uid: user.uid,
    email: user.email,
    name: user.displayName || fallbackName || user.email.split('@')[0],
  };
}

function canUseSessionStorage() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function saveFirebaseGoogleAuthIntent(intent: FirebaseGoogleAuthIntent) {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.setItem(AUTH_REDIRECT_INTENT_KEY, JSON.stringify(intent));
}

export function readFirebaseGoogleAuthIntent(): FirebaseGoogleAuthIntent | null {
  if (!canUseSessionStorage()) {
    return null;
  }

  const raw = window.sessionStorage.getItem(AUTH_REDIRECT_INTENT_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as FirebaseGoogleAuthIntent;
  } catch {
    window.sessionStorage.removeItem(AUTH_REDIRECT_INTENT_KEY);
    return null;
  }
}

export function clearFirebaseGoogleAuthIntent() {
  if (!canUseSessionStorage()) {
    return;
  }

  window.sessionStorage.removeItem(AUTH_REDIRECT_INTENT_KEY);
}

export async function waitForFirebaseUser(): Promise<FirebaseAuthUser | null> {
  if (!isFirebaseConfigured()) {
    return null;
  }

  const auth = getFirebaseAuth();
  await waitForFirebaseAuthPersistence();

  if (auth.currentUser) {
    return auth.currentUser;
  }

  return new Promise(resolve => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      unsubscribe();
      resolve(user);
    }, () => {
      unsubscribe();
      resolve(null);
    });
  });
}

/**
 * Uses signInWithPopup instead of signInWithRedirect.
 * This fixes the redirect-back-to-login bug because the popup
 * returns the user directly without navigating away from the page.
 */
export async function signInWithFirebaseGooglePopup(): Promise<FirebaseGoogleProfile> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }

  const auth = getFirebaseAuth();
  await waitForFirebaseAuthPersistence();

  const result = await signInWithPopup(auth, createGoogleProvider());

  if (!result?.user) {
    throw new Error('Google sign-in was cancelled or failed.');
  }

  return mapFirebaseUser(result.user);
}

export async function signUpWithFirebaseEmailPassword(
  email: string,
  password: string,
  name: string,
): Promise<FirebasePasswordAuthProfile> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }

  const auth = getFirebaseAuth();
  await waitForFirebaseAuthPersistence();

  const result = await createUserWithEmailAndPassword(auth, email.trim(), password);

  if (!result?.user) {
    throw new Error('Authority sign-up failed.');
  }

  if (name.trim()) {
    await updateProfile(result.user, { displayName: name.trim() });
  }

  return mapPasswordFirebaseUser(result.user, name.trim());
}

export async function signInWithFirebaseEmailPassword(
  email: string,
  password: string,
): Promise<FirebasePasswordAuthProfile> {
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase is not configured yet.');
  }

  const auth = getFirebaseAuth();
  await waitForFirebaseAuthPersistence();

  const result = await signInWithEmailAndPassword(auth, email.trim(), password);

  if (!result?.user) {
    throw new Error('Authority sign-in failed.');
  }

  return mapPasswordFirebaseUser(result.user);
}

export async function signOutFirebaseUser() {
  if (!isFirebaseConfigured()) {
    return;
  }

  await signOut(getFirebaseAuth());
}

export function getFirebaseAuthErrorCode(error: unknown) {
  if (!error || typeof error !== 'object' || !('code' in error)) {
    return '';
  }

  return String((error as FirebaseError).code || '');
}

export function getFirebaseAuthErrorMessage(
  error: unknown,
  provider: FirebaseAuthProvider,
  fallback: string,
) {
  const code = getFirebaseAuthErrorCode(error);

  if (!code) {
    return error instanceof Error ? error.message : fallback;
  }

  switch (code) {
    case 'auth/operation-not-allowed':
      return provider === 'google'
        ? 'Enable Google sign-in in Firebase Authentication before using Google login.'
        : 'Enable Email/Password sign-in in Firebase Authentication before using email login.';
    case 'auth/popup-blocked':
      return 'The browser blocked the Google sign-in popup. Allow popups and try again.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was cancelled before it finished.';
    case 'auth/unauthorized-domain':
      return 'This domain is not authorized in Firebase Authentication. Add it under Authorized domains.';
    case 'auth/email-already-in-use':
      return 'An account with this email already exists. Try signing in instead.';
    case 'auth/invalid-email':
      return 'Enter a valid email address.';
    case 'auth/weak-password':
      return 'Password must be at least 6 characters.';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return 'Invalid email or password.';
    case 'auth/network-request-failed':
      return 'Firebase could not be reached. Check your network connection and try again.';
    case 'auth/too-many-requests':
      return 'Too many failed attempts. Wait a bit and try again.';
    default:
      return error instanceof Error ? error.message : fallback;
  }
}
