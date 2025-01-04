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
      where('uid', '!=', currentUser.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Got snapshot, docs count:', snapshot.size);
      const userList: ChatUser[] = snapshot.docs
        .map(doc => {
          const data = doc.data();
          // Skip users without displayName or uid
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
          typingUsers: [],
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
      <div className="flex-1 p-4">
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse flex items-center space-x-4">
              <div className="rounded-full bg-gray-200 h-12 w-12"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (users.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-gray-500">No other users found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {users.map((user) => (
        <button
          key={user.uid}
          onClick={() => handleCreateChat(user)}
          className="w-full p-3 flex items-center space-x-3 hover:bg-gray-50 rounded-lg transition-colors"
        >
          <div className="relative flex-shrink-0">
            <UserAvatar
              user={{
                photoURL: user.photoURL,
                displayName: user.displayName || 'Anonymous User'
              }}
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
      ))}
    </div>
  );
}
