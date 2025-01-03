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
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { formatLastSeen } from '@/utils/time';

interface ChatUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  lastSeen: Date | null;
  online: boolean;
}

interface UserListProps {
  currentUser: User;
  onChatCreated?: (chatId: string) => void;
}

export default function UserList({ currentUser, onChatCreated }: UserListProps) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    console.log('Current user:', currentUser.uid);
    const usersRef = collection(db, 'users');
    const q = query(
      usersRef, 
      where('uid', '!=', currentUser.uid),
      where('displayName', '!=', null)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Got snapshot, docs count:', snapshot.size);
      const userList: ChatUser[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          if (!data.uid || !data.displayName) return null;
          
          return {
            uid: data.uid,
            displayName: data.displayName || null,
            photoURL: data.photoURL || null,
            email: data.email || null,
            lastSeen: data.lastSeen ? (data.lastSeen as Timestamp).toDate() : null,
            online: data.online || false,
          };
        })
        .filter((user): user is ChatUser => user !== null);

      console.log('Final user list:', userList);
      setUsers(userList);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching users:', error);
      setError('Failed to load users');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  const handleCreateChat = async (otherUser: ChatUser) => {
    try {
      // Create a unique chat ID
      const chatId = [currentUser.uid, otherUser.uid].sort().join('_');
      console.log('Creating chat with ID:', chatId);
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        console.log('Chat does not exist, creating new chat');
        // Get current user details
        const currentUserRef = doc(db, 'users', currentUser.uid);
        const currentUserDoc = await getDoc(currentUserRef);
        const currentUserData = currentUserDoc.data();
        console.log('Current user data:', currentUserData);

        const chatData = {
          participants: [currentUser.uid, otherUser.uid],
          participantDetails: {
            [currentUser.uid]: {
              displayName: currentUser.displayName || 'Unknown User',
              photoURL: currentUser.photoURL,
              email: currentUser.email,
              lastSeen: currentUserData?.lastSeen || serverTimestamp(),
              online: currentUserData?.online || true,
            },
            [otherUser.uid]: {
              displayName: otherUser.displayName || 'Unknown User',
              photoURL: otherUser.photoURL,
              email: otherUser.email,
              lastSeen: otherUser.lastSeen || null,
              online: otherUser.online || false,
            },
          },
          createdAt: serverTimestamp(),
          lastMessageTime: serverTimestamp(),
          lastMessage: null,
          typingUsers: {},
          draftMessages: {},
        };

        console.log('Creating chat with data:', chatData);
        await setDoc(chatRef, chatData);
        console.log('Chat created successfully');
      } else {
        console.log('Chat already exists');
      }

      // Always navigate to the chat, whether it was just created or already existed
      if (onChatCreated) {
        console.log('Navigating to chat:', chatId);
        onChatCreated(chatId);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 text-center p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.length === 0 ? (
        <div className="text-center text-gray-500 p-4">
          No other users found
        </div>
      ) : (
        users.map((user) => (
          <button
            key={user.uid}
            onClick={() => handleCreateChat(user)}
            className="w-full p-3 flex items-center space-x-3 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <div className="relative flex-shrink-0">
              <UserAvatar
                user={user}
                className="h-12 w-12 md:h-10 md:w-10"
              />
              {user.online && (
                <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center">
                <p className="font-medium text-base md:text-sm truncate">
                  {user.displayName || 'Unknown User'}
                </p>
              </div>
              <p className="text-sm text-gray-500 truncate">
                {user.email}
              </p>
              <p className="text-xs text-gray-400 hidden md:block">
                {formatLastSeen(user.lastSeen, user.online)}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}
