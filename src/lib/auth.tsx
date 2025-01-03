'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      setLoading(false);

      if (user) {
        // User is signed in
        const userDocRef = doc(db, 'users', user.uid);
        
        // Update online status when user signs in
        await setDoc(userDocRef, {
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        // Set up presence system
        const updatePresence = async () => {
          await setDoc(userDocRef, {
            online: false,
            lastSeen: serverTimestamp(),
          }, { merge: true });
        };

        // Update presence on page visibility change
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'hidden') {
            await updatePresence();
          } else {
            await setDoc(userDocRef, {
              online: true,
              lastSeen: serverTimestamp(),
            }, { merge: true });
          }
        });

        // Update presence on beforeunload
        window.addEventListener('beforeunload', () => {
          updatePresence();
        });
      }
    });

    return () => {
      unsubscribe();
      // Clean up event listeners
      document.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('beforeunload', () => {});
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Save user data to Firestore
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          online: true,
          lastSeen: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (error) {
      console.error('Error signing in with Google:', error);
    }
  };

  const signOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
