'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, GoogleAuthProvider } from 'firebase/auth';
import { doc, setDoc, serverTimestamp, collection } from 'firebase/firestore';
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
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let unsubscribe: () => void;

    const initializeAuth = async () => {
      try {
        // Set persistence to LOCAL to persist the auth state
        await auth.setPersistence('LOCAL');

        unsubscribe = onAuthStateChanged(auth, async (user) => {
          console.log('Auth state changed:', user?.email);
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
            setUser(null);
          } finally {
            setLoading(false);
            setInitialized(true);
          }
        });
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
        setInitialized(true);
      }
    };

    initializeAuth();

    // Set user as offline when the window is closed or component unmounts
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
      if (unsubscribe) {
        unsubscribe();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      handleBeforeUnload();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
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
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, {
          online: false,
          lastSeen: serverTimestamp(),
        }, { merge: true });
      }
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything until the initial auth check is complete
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
