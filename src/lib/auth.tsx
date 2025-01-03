'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  GoogleAuthProvider,
  User,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth';
import { auth, db } from './firebase';
import { doc, setDoc, serverTimestamp, writeBatch, collection, query, where, getDocs } from 'firebase/firestore';

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
      if (user) {
        // User is signed in
        const userDocRef = doc(db, 'users', user.uid);
        
        // Update online status when user signs in
        await setDoc(userDocRef, {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          online: true,
          lastSeen: serverTimestamp(),
        }, { merge: true });

        // Debounced presence update function
        let presenceTimeout: NodeJS.Timeout;
        const debouncedUpdatePresence = (online: boolean) => {
          if (presenceTimeout) clearTimeout(presenceTimeout);
          presenceTimeout = setTimeout(async () => {
            const batch = writeBatch(db);
            batch.update(userDocRef, {
              online,
              lastSeen: serverTimestamp(),
            });

            try {
              await batch.commit();
            } catch (error) {
              console.error('Error updating presence:', error);
            }
          }, 2000);
        };

        // Update presence on visibility change
        const handleVisibilityChange = () => {
          debouncedUpdatePresence(document.visibilityState === 'visible');
        };

        // Update presence on beforeunload
        const handleBeforeUnload = () => {
          // Synchronous update for page unload
          navigator.sendBeacon(
            `/api/presence?uid=${user.uid}&online=false`
          );
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        // Set user state after all setup is complete
        setUser(user);
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', () => {});
      window.removeEventListener('beforeunload', () => {});
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Create or update user document with all required fields
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        online: true,
        lastSeen: serverTimestamp(),
      }, { merge: true });

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
