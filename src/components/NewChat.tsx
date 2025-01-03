'use client';

import { useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { PlusIcon } from '@heroicons/react/24/solid';

interface NewChatProps {
  currentUser: User;
}

interface ChatUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export default function NewChat({ currentUser }: NewChatProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const startNewChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || email === currentUser.email) return;

    setLoading(true);
    setError('');

    try {
      // Find user by email
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('email', '==', email));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError('User not found');
        setLoading(false);
        return;
      }

      const otherUser = querySnapshot.docs[0].data() as ChatUser;

      // Check if chat already exists
      const chatsRef = collection(db, 'chats');
      const chatQuery = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.uid)
      );

      const chatSnapshot = await getDocs(chatQuery);
      const existingChat = chatSnapshot.docs.some(doc => {
        const chat = doc.data();
        return chat.participants.includes(otherUser.uid);
      });

      if (existingChat) {
        setError('Chat already exists');
        setLoading(false);
        return;
      }

      // Create new chat
      await addDoc(chatsRef, {
        participants: [currentUser.uid, otherUser.uid],
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
      });

      // Clear form
      setEmail('');
      setError('');
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={startNewChat} className="space-y-2">
      <div className="flex space-x-2">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email to start chat"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-500 text-white rounded-lg p-2 hover:bg-blue-600 focus:outline-none disabled:opacity-50"
        >
          <PlusIcon className="h-5 w-5" />
        </button>
      </div>
      {error && <p className="text-red-500 text-sm">{error}</p>}
    </form>
  );
}
