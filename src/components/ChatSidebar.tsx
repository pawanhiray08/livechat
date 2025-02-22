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
  DocumentSnapshot,
  startAfter,
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

const CHATS_PER_PAGE = 10;

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
  const [lastChat, setLastChat] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const loadChats = useCallback(async (isInitial: boolean = false) => {
    if (!currentUser?.uid || (!isInitial && !hasMore)) return;

    try {
      let q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc'),
        limit(CHATS_PER_PAGE)
      );

      if (!isInitial && lastChat) {
        q = query(
          collection(db, 'chats'),
          where('participants', 'array-contains', currentUser.uid),
          orderBy('lastMessageTime', 'desc'),
          startAfter(lastChat),
          limit(CHATS_PER_PAGE)
        );
      }

      const snapshot = await getDocs(q);
      const newChats = await Promise.all(
        snapshot.docs.map(async (doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            participants: data.participants || [],
            participantDetails: data.participantDetails || {},
            createdAt: data.createdAt?.toDate() || new Date(),
            lastMessageTime: data.lastMessageTime?.toDate() || null,
            lastMessage: data.lastMessage || null,
            typingUsers: data.typingUsers || {}
          };
        })
      );

      if (isInitial) {
        setChats(newChats);
      } else {
        setChats(prev => [...prev, ...newChats]);
      }

      setLastChat(snapshot.docs[snapshot.docs.length - 1] || null);
      setHasMore(snapshot.docs.length === CHATS_PER_PAGE);
      setError(null);
    } catch (err) {
      console.error('Error loading chats:', err);
      setError('Failed to load chats. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [currentUser?.uid, hasMore, lastChat]);

  // Initial load
  useEffect(() => {
    loadChats(true);
  }, [loadChats]);

  // Real-time updates for existing chats
  useEffect(() => {
    if (!currentUser?.uid) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageTime', 'desc'),
      limit(CHATS_PER_PAGE)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'modified' || change.type === 'added') {
          const data = change.doc.data();
          const updatedChat: Chat = {
            id: change.doc.id,
            participants: data.participants || [],
            participantDetails: data.participantDetails || {},
            createdAt: data.createdAt?.toDate() || new Date(),
            lastMessageTime: data.lastMessageTime?.toDate() || null,
            lastMessage: data.lastMessage || null,
            typingUsers: data.typingUsers || {}
          };

          setChats(prev => {
            const index = prev.findIndex(chat => chat.id === updatedChat.id);
            if (index === -1) {
              return [updatedChat, ...prev];
            }
            const newChats = [...prev];
            newChats[index] = updatedChat;
            return newChats.sort((a, b) => 
              (b.lastMessageTime?.getTime() || 0) - (a.lastMessageTime?.getTime() || 0)
            );
          });
        }
      });
    });

    return () => unsubscribe();
  }, [currentUser?.uid]);

  const rowVirtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => null,
    estimateSize: useCallback(() => 80, []),
    overscan: 5,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const chatListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = chatListRef.current;
    if (!container) return;

    const handleScroll = () => {
      if (
        container.scrollHeight - container.scrollTop <= container.clientHeight * 1.5 &&
        !loading &&
        hasMore
      ) {
        loadChats();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [loading, hasMore, loadChats]);

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-white border-r">
        <div className="p-4 border-b">
          <div className="flex items-center justify-between mb-4">
            <div className="h-10 w-10 rounded-full bg-gray-200 animate-pulse"></div>
            <div className="space-x-2">
              <div className="h-8 w-8 rounded bg-gray-200 animate-pulse inline-block"></div>
              <div className="h-8 w-8 rounded bg-gray-200 animate-pulse inline-block"></div>
            </div>
          </div>
          <div className="h-8 w-3/4 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center space-x-3 p-2">
              <div className="h-12 w-12 rounded-full bg-gray-200 animate-pulse"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/4 bg-gray-200 animate-pulse rounded"></div>
                <div className="h-3 w-3/4 bg-gray-200 animate-pulse rounded"></div>
              </div>
            </div>
          ))}
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
              onClick={() => loadChats()}
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
        ref={chatListRef}
        className="flex-1 overflow-y-auto"
      >
        {loading && (
          <div className="p-4 text-center">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500" />
          </div>
        )}
        {!loading && (
          <>
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
            {!loading && !hasMore && chats.length > 0 && (
              <div className="p-4 text-center text-gray-500">
                No more chats to load
              </div>
            )}
            {!loading && chats.length === 0 && (
              <div className="p-4 text-center text-gray-500">
                No chats found
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
