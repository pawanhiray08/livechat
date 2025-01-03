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
import UserAvatar from './UserAvatar';
import { ChatUser } from '@/types';

interface UserListProps {
  currentUser: User;
}

export default function UserList({ currentUser }: UserListProps) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('uid', '!=', currentUser.uid));
        const querySnapshot = await getDocs(q);
        
        const userList: ChatUser[] = [];
        querySnapshot.forEach((doc) => {
          userList.push(doc.data() as ChatUser);
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

  const startChat = async (otherUser: ChatUser) => {
    try {
      setError('');
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
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Failed to create chat');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-gray-500">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="text-red-500 text-sm text-center py-2">{error}</div>
      )}
      {users.length === 0 ? (
        <div className="text-gray-500 text-center py-4">No other users found</div>
      ) : (
        users.map((user) => (
          <div
            key={user.uid}
            className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center space-x-3">
              <UserAvatar user={user} className="h-8 w-8" />
              <div>
                <p className="font-medium text-sm">{user.displayName}</p>
                <p className="text-xs text-gray-500">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => startChat(user)}
              className="bg-blue-500 text-white px-3 py-1 text-sm rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Start Chat
            </button>
          </div>
        ))
      )}
    </div>
  );
}
