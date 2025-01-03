'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
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
  searchUsers?: (searchTerm: string) => Promise<any>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => {},
  signOut: async () => {},
  searchUsers: async () => [],
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const signInWithGoogle = async () => {
    setLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        lastSeen: serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await auth.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const searchUsers = async (searchTerm: string) => {
    if (!searchTerm.trim()) return [];
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef,
      where('displayName', '>=', searchTerm),
      where('displayName', '<=', searchTerm + '\uf8ff'),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Update user document in Firestore
          const userRef = doc(db, 'users', user.uid);
          await setDoc(userRef, {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastSeen: serverTimestamp(),
            online: true,
          }, { merge: true });
          setUser(user);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error updating user document:', error);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signInWithGoogle,
      signOut,
      searchUsers,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  return useContext(AuthContext);
};
