'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
  limit,
  doc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Chat } from '@/types';
import { formatLastSeen } from '@/utils/time';
import { useVirtualizer } from '@tanstack/react-virtual';

interface ChatSidebarProps {
  currentUser: User;
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onShowSettings: () => void;
  onShowSearch: () => void;
  onShowUsers: () => void;
}

export default function ChatSidebar({
  currentUser,
  selectedChatId,
  onChatSelect,
  onShowSettings,
  onShowSearch,
  onShowUsers,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  useEffect(() => {
    console.log('Setting up chat listener for user:', currentUser?.uid);
    if (!currentUser?.uid) {
      console.log('No user ID available');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // First, update the current user's online status
      const userRef = doc(db, 'users', currentUser.uid);
      getDoc(userRef).then(async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();
          if (!userData.online) {
            await updateDoc(userRef, {
              online: true,
              lastSeen: Timestamp.now(),
            });
          }
        }
      });

      // Set up chat listener
      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc'),
        limit(50)
      );

      console.log('Subscribing to chat updates...');
      const unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          try {
            console.log('Received chat update, docs count:', snapshot.docs.length);
            const chatList: Chat[] = [];

            for (const doc of snapshot.docs) {
              try {
                const data = doc.data();
                console.log('Processing chat:', doc.id, data);

                if (!data.participants || !Array.isArray(data.participants)) {
                  console.error('Invalid chat data - missing or invalid participants:', doc.id);
                  continue;
                }

                // Ensure all required fields are present
                const chat: Chat = {
                  id: doc.id,
                  participants: data.participants,
                  participantDetails: data.participantDetails || {},
                  lastMessage: data.lastMessage || null,
                  lastMessageTime: data.lastMessageTime || Timestamp.now(), // Provide a default timestamp
                  typingUsers: Array.isArray(data.typingUsers) ? data.typingUsers : [],
                  draftMessages: typeof data.draftMessages === 'object' ? data.draftMessages : {},
                };

                // Validate participant details
                if (!chat.participantDetails || typeof chat.participantDetails !== 'object') {
                  console.error('Invalid participant details for chat:', doc.id);
                  chat.participantDetails = {};
                }

                chatList.push(chat);
              } catch (docErr) {
                console.error('Error processing individual chat:', doc.id, docErr);
                // Continue processing other chats
                continue;
              }
            }

            console.log('Setting chats:', chatList.length);
            setChats(chatList);
            setLoading(false);
          } catch (err) {
            console.error('Error processing chat data:', err);
            setError('Error processing chat data');
            setLoading(false);
          }
        },
        (err) => {
          console.error('Firestore subscription error:', err);
          setError('Failed to load chats');
          setLoading(false);
        }
      );

      return () => {
        console.log('Cleaning up chat subscription');
        unsubscribe();
      };
    } catch (err) {
      console.error('Error setting up chat listener:', err);
      setError('Failed to set up chat listener');
      setLoading(false);
    }
  }, [currentUser?.uid]);

  if (loading) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-gray-200">
          <h2 className="text-xl font-semibold">Chats</h2>
          <div className="flex space-x-2">
            <button
              onClick={onShowUsers}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Find Users"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={onShowSettings}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Settings"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
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
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-gray-200">
          <h2 className="text-xl font-semibold">Chats</h2>
          <div className="flex space-x-2">
            <button
              onClick={onShowUsers}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Find Users"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={onShowSettings}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Settings"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
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
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 flex justify-between items-center border-b border-gray-200">
          <h2 className="text-xl font-semibold">Chats</h2>
          <div className="flex space-x-2">
            <button
              onClick={onShowUsers}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Find Users"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </button>
            <button
              onClick={onShowSettings}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Settings"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No chats yet</p>
            <button
              onClick={onShowUsers}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Find Users
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 flex justify-between items-center border-b border-gray-200">
        <h2 className="text-xl font-semibold">Chats</h2>
        <div className="flex space-x-2">
          <button
            onClick={onShowUsers}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="Find Users"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </button>
          <button
            onClick={onShowSettings}
            className="p-2 hover:bg-gray-100 rounded-full"
            title="Settings"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={parentRef}
        className="flex-1 overflow-y-auto"
      >
        <div
          style={{
            height: `${rowVirtualizer.getTotalSize()}px`,
            width: '100%',
            position: 'relative',
          }}
        >
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const chat = chats[virtualRow.index];
            const otherParticipantId = chat.participants.find(id => id !== currentUser.uid);
            const otherParticipant = otherParticipantId ? chat.participantDetails?.[otherParticipantId] : null;

            return (
              <div
                key={chat.id}
                className={`absolute top-0 left-0 w-full ${
                  selectedChatId === chat.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="p-4 flex items-center space-x-4">
                  <div className="relative">
                    <UserAvatar
                      user={{
                        photoURL: otherParticipant?.photoURL || null,
                        displayName: otherParticipant?.displayName || 'Unknown User',
                      }}
                      size={48}
                    />
                    {otherParticipant?.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {otherParticipant?.displayName || 'Unknown User'}
                      </h3>
                      {chat.lastMessageTime && (
                        <span className="text-xs text-gray-500">
                          {formatLastSeen(chat.lastMessageTime)}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 truncate">
                      {chat.lastMessage?.text || 'No messages yet'}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
