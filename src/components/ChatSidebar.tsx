'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { User } from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  orderBy, 
  Timestamp, 
  limit,
  getDocs,
  setDoc,
  serverTimestamp,
  DocumentReference,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
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

interface UserData {
  displayName: string;
  photoURL: string | null;
  email: string | null;
  lastSeen: Timestamp | null;
  online: boolean;
}

interface FirestoreUserData extends DocumentData {
  displayName?: string;
  photoURL?: string;
  email?: string;
  lastSeen?: Timestamp;
  online?: boolean;
}

interface ChatMessage {
  text: string;
  senderId: string;
  timestamp: Timestamp;
}

interface Chat {
  id: string;
  participants: string[];
  participantDetails: { [key: string]: UserData };
  createdAt: Date;
  lastMessageTime: Date | null;
  lastMessage: ChatMessage | null;
  typingUsers: { [key: string]: boolean };
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  const loadChats = useCallback(async () => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create a query for chats
      const chatsQuery = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc'),
        limit(50)
      );

      // Get initial chats
      const snapshot = await getDocs(chatsQuery);
      const chatsData: Chat[] = [];
      const userCache: { [key: string]: any } = {};

      // Process chat documents
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        const chat: Chat = {
          id: doc.id,
          participants: data.participants || [],
          participantDetails: data.participantDetails || {},
          createdAt: data.createdAt?.toDate() || new Date(),
          lastMessageTime: data.lastMessageTime?.toDate() || null,
          lastMessage: data.lastMessage ? {
            text: data.lastMessage.text || '',
            senderId: data.lastMessage.senderId || '',
            timestamp: data.lastMessage.timestamp || Timestamp.now(),
          } : null,
          typingUsers: data.typingUsers || {},
        };
        chatsData.push(chat);
      });

      // Update state with initial data
      setChats(chatsData);
      setLoading(false);

      // Set up real-time listener for updates
      const unsubscribe = onSnapshot(chatsQuery, {
        next: (snapshot) => {
          try {
            const updatedChats = [...chatsData];
            
            snapshot.docChanges().forEach((change) => {
              const data = change.doc.data();
              const chatIndex = updatedChats.findIndex(c => c.id === change.doc.id);
              
              const updatedChat: Chat = {
                id: change.doc.id,
                participants: data.participants || [],
                participantDetails: data.participantDetails || {},
                createdAt: data.createdAt?.toDate() || new Date(),
                lastMessageTime: data.lastMessageTime?.toDate() || null,
                lastMessage: data.lastMessage ? {
                  text: data.lastMessage.text || '',
                  senderId: data.lastMessage.senderId || '',
                  timestamp: data.lastMessage.timestamp || Timestamp.now(),
                } : null,
                typingUsers: data.typingUsers || {},
              };

              if (change.type === 'added' && chatIndex === -1) {
                updatedChats.push(updatedChat);
              } else if (change.type === 'modified' && chatIndex !== -1) {
                updatedChats[chatIndex] = updatedChat;
              } else if (change.type === 'removed' && chatIndex !== -1) {
                updatedChats.splice(chatIndex, 1);
              }
            });

            // Sort chats by last message time
            updatedChats.sort((a, b) => {
              const timeA = a.lastMessageTime?.getTime() || 0;
              const timeB = b.lastMessageTime?.getTime() || 0;
              return timeB - timeA;
            });

            setChats(updatedChats);
          } catch (error) {
            console.error('Error processing chat updates:', error);
          }
        },
        error: (error) => {
          console.error('Error in chat subscription:', error);
          setError('Failed to load chats');
        }
      });

      return unsubscribe;
    } catch (error) {
      console.error('Error loading chats:', error);
      setError('Failed to load chats');
      setLoading(false);
    }
  }, [currentUser?.uid]);

  // Initial load
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    const initializeChats = async () => {
      unsubscribe = await loadChats();
    };

    initializeChats();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadChats]);

  const handleRetry = useCallback(() => {
    loadChats();
  }, [loadChats]);

  if (loading) {
    return (
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200">
          <div className="animate-pulse flex items-center justify-between">
            <div className="h-8 w-24 bg-gray-200 rounded"></div>
            <div className="flex space-x-2">
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
              <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="animate-pulse p-4 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <div className="h-12 w-12 bg-gray-200 rounded-full"></div>
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
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-gray-500 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
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
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Chats</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={onShowSearch}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="Search"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
            <button
              onClick={onShowUsers}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="New Chat"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            <button
              onClick={onShowSettings}
              className="p-2 hover:bg-gray-100 rounded-full"
              aria-label="Settings"
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
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
            >
              Start a New Chat
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col h-full">
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="text-xl font-semibold">Chats</h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onShowSearch}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Search"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            onClick={onShowUsers}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="New Chat"
          >
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            onClick={onShowSettings}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Settings"
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
        className="flex-1 overflow-auto"
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
            if (!chat) return null;
            
            const otherParticipantId = chat.participants?.find(id => id !== currentUser.uid);
            const otherParticipant = otherParticipantId ? chat.participantDetails[otherParticipantId] : null;
            const isSelected = chat.id === selectedChatId;

            return (
              <div
                key={chat.id}
                ref={rowVirtualizer.measureElement}
                data-index={virtualRow.index}
                className={`absolute top-0 left-0 w-full ${
                  isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                } cursor-pointer`}
                style={{
                  height: `${virtualRow.size}px`,
                  transform: `translateY(${virtualRow.start}px)`,
                }}
                onClick={() => onChatSelect(chat.id)}
              >
                <div className="p-4 flex items-center space-x-4">
                  <UserAvatar
                    user={{
                      photoURL: otherParticipant?.photoURL || null,
                      displayName: otherParticipant?.displayName || null
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {otherParticipant?.displayName || 'Anonymous User'}
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
