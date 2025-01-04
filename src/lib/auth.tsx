'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  GoogleAuthProvider,
  browserLocalPersistence,
  setPersistence
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
  const [initialized, setInitialized] = useState(false);

  // Set up auth state listener
  useEffect(() => {
    console.log('Setting up auth state listener');
    
    // Initialize auth with local persistence
    setPersistence(auth, browserLocalPersistence)
      .then(() => {
        console.log('Auth persistence set to local');
      })
      .catch((error) => {
        console.error('Error setting auth persistence:', error);
      });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('Auth state changed:', firebaseUser?.email);
      
      try {
        if (firebaseUser) {
          const { uid, email, displayName, photoURL } = firebaseUser;
          
          // Update user document in Firestore
          const userRef = doc(db, 'users', uid);
          await setDoc(userRef, {
            uid,
            email,
            displayName: displayName || 'Anonymous User',
            photoURL,
            lastSeen: serverTimestamp(),
            online: true,
          }, { merge: true });

          // Update local state
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

    // Cleanup function
    return () => {
      unsubscribe();
    };
  }, []);

  // Handle user going offline
  useEffect(() => {
    const handleOffline = async () => {
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

    window.addEventListener('beforeunload', handleOffline);
    return () => {
      window.removeEventListener('beforeunload', handleOffline);
      handleOffline();
    };
  }, []);

  const signInWithGoogle = async () => {
    try {
      setLoading(true);
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        prompt: 'select_account'
      });
      
      await signInWithPopup(auth, provider);
      const currentUser = auth.currentUser;
      if (!currentUser) throw new Error('Failed to get current user after sign in');
      
      await setDoc(doc(db, 'users', currentUser.uid), {
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

  // Show loading state only during initialization
  if (!initialized) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
          <p className="text-gray-600">Initializing app...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
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
