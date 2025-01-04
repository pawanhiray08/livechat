'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence,
  UserCredential
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const defaultAuthContext: AuthContextType = {
  user: null,
  loading: true,
  signInWithGoogle: async () => {
    throw new Error('AuthContext not initialized');
  },
  logout: async () => {
    throw new Error('AuthContext not initialized');
  },
};

const AuthContext = createContext<AuthContextType>(defaultAuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set browser persistence
    setPersistence(auth, browserLocalPersistence).then(() => {
      const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          // Update user status in Firestore
          const userRef = doc(db, 'users', firebaseUser.uid);
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName || 'Anonymous User',
            photoURL: firebaseUser.photoURL,
            lastSeen: serverTimestamp(),
            online: true,
          }, { merge: true });

          setUser({
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            displayName: firebaseUser.displayName,
            photoURL: firebaseUser.photoURL,
          });
        } else {
          setUser(null);
        }
        setLoading(false);
      });

      return () => unsubscribe();
    });
  }, []);

  const signInWithGoogle = async () => {
    const MAX_RETRIES = 2;
    const TIMEOUT_MS = 20000; // 20 seconds
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const provider = new GoogleAuthProvider();
        provider.setCustomParameters({
          prompt: 'select_account'
        });

        // Create a timeout promise
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Sign in is taking longer than expected. Please check your internet connection and try again.')), TIMEOUT_MS)
        );

        // Attempt sign in with timeout
        const result = await Promise.race([
          signInWithPopup(auth, provider),
          timeoutPromise
        ]) as UserCredential;

        if ('user' in result && result.user) {
          const userRef = doc(db, 'users', result.user.uid);
          await setDoc(userRef, {
            uid: result.user.uid,
            email: result.user.email,
            displayName: result.user.displayName || 'Anonymous User',
            photoURL: result.user.photoURL,
            lastSeen: serverTimestamp(),
            online: true,
          }, { merge: true });

          return; // Success - exit the function
        }
      } catch (error) {
        lastError = error as Error;
        
        // If this is not our last attempt, wait before retrying
        if (attempt < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds before retry
          continue;
        }
      }
    }

    // If we get here, all attempts failed
    throw new Error(lastError?.message || 'Failed to sign in. Please try again.');
  };

  const logout = async () => {
    try {
      if (user) {
        // Update user status before signing out
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          online: false,
          lastSeen: serverTimestamp(),
        }, { merge: true });
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  const value = {
    user,
    loading,
    signInWithGoogle,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
