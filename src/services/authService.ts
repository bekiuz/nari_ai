import {
  createUserWithEmailAndPassword,
  getRedirectResult,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
  User as FirebaseUser,
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase/config';

function isNativeCapacitor(): boolean {
  return typeof window !== 'undefined' && Boolean((window as any).Capacitor?.isNativePlatform?.());
}

async function ensureUserProfile(user: FirebaseUser): Promise<void> {
  const userRef = doc(db, 'users', user.uid);
  const fallbackName = user.displayName || user.email?.split('@')[0] || 'User';
  const now = new Date().toISOString();

  try {
    const existing = await getDoc(userRef);

    if (!existing.exists()) {
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email || '',
        displayName: fallbackName,
        photoURL: user.photoURL || '',
        createdAt: now,
        updatedAt: now,
      });
    } else {
      await setDoc(
        userRef,
        {
          email: user.email || existing.data().email || '',
          displayName: user.displayName || existing.data().displayName || fallbackName,
          photoURL: user.photoURL || existing.data().photoURL || '',
          updatedAt: now,
        },
        { merge: true }
      );
    }
  } catch (error) {
    // Authentication is already successful; a temporary Firestore problem
    // must not turn a valid account creation into a false authentication error.
    console.warn('User profile sync skipped:', error);
  }
}

export function getAuthErrorMessage(error: any, isRegister = false): string {
  const code = String(error?.code || '').toLowerCase();
  const rawMessage = String(error?.message || '');

  if (code.includes('operation-not-allowed')) {
    return 'Email/password authentication is disabled in Firebase. Enable Email/Password in Firebase Authentication → Sign-in method.';
  }

  if (code.includes('email-already-in-use')) {
    return 'This email is already registered. Sign in instead.';
  }

  if (code.includes('invalid-email')) {
    return 'Please enter a valid email address.';
  }

  if (code.includes('weak-password')) {
    return 'Password must be at least 6 characters long.';
  }

  if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) {
    return 'Invalid email or password.';
  }

  if (code.includes('too-many-requests')) {
    return 'Too many attempts. Please wait a little and try again.';
  }

  if (code.includes('network-request-failed')) {
    return 'Network connection failed. Check your internet connection and try again.';
  }

  if (code.includes('popup-closed-by-user') || code.includes('cancelled-popup-request')) {
    return 'Google sign-in was cancelled.';
  }

  if (code.includes('popup-blocked')) {
    return 'Google sign-in popup was blocked. Try again or use email/password.';
  }

  if (code.includes('unauthorized-domain')) {
    return 'This app domain is not authorized for Firebase Authentication yet.';
  }

  if (code.includes('invalid-api-key')) {
    return 'Firebase configuration is invalid. Please check the project configuration.';
  }

  if (rawMessage) {
    return rawMessage.replace(/^FirebaseError:\s*/i, '');
  }

  return isRegister
    ? 'Account creation failed. Please check your details and try again.'
    : 'Sign-in failed. Please check your credentials and try again.';
}

export async function registerWithEmail(
  email: string,
  pass: string,
  displayName?: string
): Promise<FirebaseUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, normalizedEmail, pass);

  const cleanName = displayName?.trim();
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName });
  }

  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function loginWithEmail(email: string, pass: string): Promise<FirebaseUser> {
  const normalizedEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, normalizedEmail, pass);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function loginWithGoogle(): Promise<FirebaseUser | null> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  if (isNativeCapacitor()) {
    await signInWithRedirect(auth, provider);
    return null;
  }

  const cred = await signInWithPopup(auth, provider);
  await ensureUserProfile(cred.user);
  return cred.user;
}

export async function completeGoogleRedirect(): Promise<FirebaseUser | null> {
  const result = await getRedirectResult(auth);
  if (!result?.user) return null;

  await ensureUserProfile(result.user);
  return result.user;
}

export async function logoutUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function getAuthToken(): Promise<string | null> {
  if (!auth.currentUser) return null;
  return auth.currentUser.getIdToken();
}
