'use client';

import { useState, useEffect } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';

const provider = new GoogleAuthProvider();

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Update user document in Firestore
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, {
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          photoURL: user.photoURL,
          lastSeen: serverTimestamp(),
          online: true,
        }, { merge: true }); // Use merge to preserve other fields
      }
      setUser(user);
      setLoading(false);
    });

    // Set user offline when tab/window closes
    const handleBeforeUnload = async () => {
      if (auth.currentUser) {
        const userRef = doc(db, 'users', auth.currentUser.uid);
        await setDoc(userRef, {
          lastSeen: serverTimestamp(),
          online: false,
        }, { merge: true });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  const signIn = async () => {
    try {
      const result = await signInWithPopup(auth, provider);
      const user = result.user;
      
      // Update user document in Firestore
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        uid: user.uid,
        displayName: user.displayName,
        email: user.email,
        photoURL: user.photoURL,
        lastSeen: serverTimestamp(),
        online: true,
      }, { merge: true });

      return user;
    } catch (error) {
      console.error('Error signing in:', error);
      throw error;
    }
  };

  const signOut = async () => {
    if (auth.currentUser) {
      // Set user offline before signing out
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await setDoc(userRef, {
        lastSeen: serverTimestamp(),
        online: false,
      }, { merge: true });
    }
    await auth.signOut();
  };

  return { user, loading, signIn, signOut };
}
