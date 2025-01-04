'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore/lite';
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

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          const { uid, email, displayName, photoURL } = user;
          
          // Update or create user document in Firestore
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            uid,
            email,
            displayName: displayName || 'Anonymous User',
            photoURL,
            lastSeen: serverTimestamp(),
            online: true,
          }, { merge: true });

          setUser({ uid, email, displayName, photoURL });
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error updating user data:', error);
      } finally {
        setLoading(false);
      }
    });

    // Set user as offline when the window is closed
    const handleBeforeUnload = async () => {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        try {
          await setDoc(userRef, {
            online: false,
            lastSeen: serverTimestamp(),
          }, { merge: true });
        } catch (error) {
          console.error('Error updating offline status:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const { uid, email, displayName, photoURL } = result.user;
      
      // Create/update user document
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, {
        uid,
        email,
        displayName: displayName || 'Anonymous User',
        photoURL,
        lastSeen: serverTimestamp(),
        online: true,
      }, { merge: true });
    } catch (error: any) {
      console.error('Google sign in error:', error);
      throw error;
    }
  };

  const logout = async () => {
    if (auth.currentUser) {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      try {
        await setDoc(userRef, {
          online: false,
          lastSeen: serverTimestamp(),
        }, { merge: true });
        await signOut(auth);
      } catch (error) {
        console.error('Error signing out:', error);
        throw error;
      }
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
