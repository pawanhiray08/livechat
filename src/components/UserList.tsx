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
  const [creatingChat, setCreatingChat] = useState(false);

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
    if (creatingChat) return;
    
    try {
      setCreatingChat(true);
      setError('');
      
      // Get all chats where current user is a participant
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.uid)
      );
      
      const chatSnapshot = await getDocs(q);
      let existingChatId: string | null = null;

      // Check if any of these chats include the other user
      chatSnapshot.forEach((doc) => {
        const chatData = doc.data();
        if (chatData.participants.includes(otherUser.uid)) {
          existingChatId = doc.id;
        }
      });

      if (existingChatId) {
        // Instead of showing error, we could optionally navigate to the existing chat
        setError('Chat already exists with this user');
        return;
      }

      // Create new chat with participant details
      const newChatRef = await addDoc(chatsRef, {
        participants: [currentUser.uid, otherUser.uid],
        participantDetails: {
          [currentUser.uid]: {
            displayName: currentUser.displayName || 'Unknown User',
            photoURL: currentUser.photoURL || null,
            email: currentUser.email || null,
          },
          [otherUser.uid]: {
            displayName: otherUser.displayName || 'Unknown User',
            photoURL: otherUser.photoURL || null,
            email: otherUser.email || null,
          },
        },
        createdAt: serverTimestamp(),
        lastMessageTime: serverTimestamp(),
        lastMessage: null,
      });

      console.log('New chat created:', newChatRef.id);
      setError('');
      
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Failed to create chat');
    } finally {
      setCreatingChat(false);
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
                <p className="font-medium text-sm">{user.displayName || 'Unknown User'}</p>
                <p className="text-xs text-gray-500">{user.email || 'No email'}</p>
              </div>
            </div>
            <button
              onClick={() => startChat(user)}
              disabled={creatingChat}
              className={`${
                creatingChat
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white px-3 py-1 text-sm rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors`}
            >
              {creatingChat ? 'Creating...' : 'Start Chat'}
            </button>
          </div>
        ))
      )}
    </div>
  );
}
