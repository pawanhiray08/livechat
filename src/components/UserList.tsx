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
          const userData = doc.data();
          userList.push({
            uid: userData.uid,
            email: userData.email,
            displayName: userData.displayName,
            photoURL: userData.photoURL,
            lastSeen: userData.lastSeen
          });
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

  const checkExistingChat = async (currentUserId: string, otherUserId: string) => {
    const chatsRef = collection(db, 'chats');
    
    // Check if both users are participants in the same chat
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUserId)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.some(doc => {
      const participants = doc.data().participants;
      return participants.includes(otherUserId);
    });
  };

  const startChat = async (otherUser: ChatUser) => {
    if (creatingChat) return;
    
    try {
      setCreatingChat(true);
      setError('');
      
      // Check if chat exists
      const chatExists = await checkExistingChat(currentUser.uid, otherUser.uid);
      
      if (chatExists) {
        setError('Chat already exists with this user');
        return;
      }

      // Create new chat with participant details
      const newChatRef = await addDoc(collection(db, 'chats'), {
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
        users.map((user) => {
          const displayName = user.displayName || 'Unknown User';
          const email = user.email || 'No email';
          
          return (
            <div
              key={user.uid}
              className="flex items-center justify-between p-3 bg-white rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center space-x-3">
                <UserAvatar 
                  user={{
                    displayName,
                    photoURL: user.photoURL,
                    email
                  }} 
                  className="h-8 w-8" 
                />
                <div>
                  <p className="font-medium text-sm">{displayName}</p>
                  <p className="text-xs text-gray-500">{email}</p>
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
          );
        })
      )}
    </div>
  );
}
