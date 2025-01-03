'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  getDocs,
  addDoc,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { UserAvatar } from './UserAvatar';

interface UserListProps {
  currentUser: User;
}

interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export default function UserList({ currentUser }: UserListProps) {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const userList: AppUser[] = [];
        querySnapshot.forEach((doc) => {
          userList.push(doc.data() as AppUser);
        });
        
        setUsers(userList);
      } catch (error) {
        console.error('Error fetching users:', error);
        setError('Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [currentUser.uid]);

  const startChat = async (otherUser: AppUser) => {
    try {
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
        setError('Chat already exists with this user');
        return;
      }

      // Create new chat
      await addDoc(chatsRef, {
        participants: [currentUser.uid, otherUser.uid],
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
      });

      setError('');
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Failed to create chat');
    }
  };

  if (loading) {
    return <div className="text-center py-4">Loading users...</div>;
  }

  if (error) {
    return <div className="text-red-500 text-center py-4">{error}</div>;
  }

  return (
    <div className="p-4">
      <h2 className="text-xl font-semibold mb-4">All Users</h2>
      <div className="space-y-2">
        {users.map((user) => (
          <div
            key={user.uid}
            className="flex items-center justify-between p-3 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <UserAvatar user={user as any} className="h-10 w-10" />
              <div>
                <p className="font-medium">{user.displayName}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => startChat(user)}
              className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Chat
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
