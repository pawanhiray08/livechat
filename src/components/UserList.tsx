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
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    try {
      const usersRef = collection(db, 'users');
      const q = query(
        usersRef,
        where('uid', '!=', currentUser.uid)
      );

      const unsubscribe = onSnapshot(q, 
        (snapshot) => {
          try {
            const userList: ChatUser[] = [];
            
            snapshot.docs.forEach((doc) => {
              const data = doc.data();
              if (!data || !data.uid) return;

              userList.push({
                uid: data.uid,
                displayName: data.displayName || 'Anonymous User',
                photoURL: data.photoURL || null,
                email: data.email || null,
                lastSeen: data.lastSeen ? (data.lastSeen as Timestamp).toDate() : null,
                online: data.online || false,
              });
            });

            setUsers(userList);
            setLoading(false);
            setError('');
          } catch (err) {
            console.error('Error processing users:', err);
            setError('Error loading users. Please try again.');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Error in user subscription:', err);
          setError('Failed to load users. Please check your connection.');
          setLoading(false);
        }
      );

      return () => unsubscribe();
    } catch (err) {
      console.error('Error setting up user listener:', err);
      setError('Failed to initialize user list. Please refresh.');
      setLoading(false);
    }
  }, [currentUser?.uid]);

  const handleCreateChat = async (otherUser: ChatUser) => {
    if (!currentUser?.uid) return;
    
    try {
      const chatId = [currentUser.uid, otherUser.uid].sort().join('_');
      const chatRef = doc(db, 'chats', chatId);
      const chatDoc = await getDoc(chatRef);

      if (!chatDoc.exists()) {
        await setDoc(chatRef, {
          participants: [currentUser.uid, otherUser.uid],
          participantDetails: {
            [currentUser.uid]: {
              displayName: currentUser.displayName || 'Unknown User',
              photoURL: currentUser.photoURL,
              email: currentUser.email,
              lastSeen: serverTimestamp(),
              online: true,
            },
            [otherUser.uid]: {
              displayName: otherUser.displayName,
              photoURL: otherUser.photoURL,
              email: otherUser.email,
              lastSeen: otherUser.lastSeen || null,
              online: otherUser.online,
            },
          },
          createdAt: serverTimestamp(),
          lastMessageTime: serverTimestamp(),
          lastMessage: null,
          typingUsers: {},
          draftMessages: {},
        });
      }

      if (onChatCreated) {
        onChatCreated(chatId);
      }
    } catch (error) {
      console.error('Error creating chat:', error);
      setError('Failed to create chat. Please try again.');
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
          <div className="flex-1 min-w-0 text-left">
            <p className="font-medium text-gray-900 truncate">
              {user.displayName || 'Anonymous User'}
            </p>
            <p className="text-sm text-gray-500 truncate">
              {user.online ? 'Online' : formatLastSeen(user.lastSeen, user.online)}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
