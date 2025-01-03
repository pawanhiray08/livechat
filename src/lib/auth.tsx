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
        const updatePresence = async (online: boolean) => {
          const batch = writeBatch(db);
          
          // Update user document
          batch.update(userDocRef, {
            online,
            lastSeen: serverTimestamp(),
          });

          // Find all chats where user is a participant
          const chatsRef = collection(db, 'chats');
          const q = query(chatsRef, where('participants', 'array-contains', user.uid));
          const chatDocs = await getDocs(q);

          // Update user's online status in all chats
          chatDocs.forEach((chatDoc) => {
            const chatRef = doc(db, 'chats', chatDoc.id);
            batch.update(chatRef, {
              [`participantDetails.${user.uid}.online`]: online,
              [`participantDetails.${user.uid}.lastSeen`]: serverTimestamp(),
            });
          });

          // Commit all updates
          await batch.commit();
        };

        // Update presence on page visibility change
        document.addEventListener('visibilitychange', async () => {
          if (document.visibilityState === 'hidden') {
            await updatePresence(false);
          } else {
            await updatePresence(true);
          }
        });

        // Update presence on beforeunload
        window.addEventListener('beforeunload', () => {
          updatePresence(false);
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
