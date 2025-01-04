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
  getDocs,
  doc,
  setDoc,
  serverTimestamp,
  DocumentReference
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
  email: string;
  lastSeen: Timestamp;
  online: boolean;
}

interface FirestoreUserData {
  displayName?: string;
  photoURL?: string;
  email?: string;
  lastSeen?: Timestamp;
  online?: boolean;
}

interface Chat {
  id: string;
  participants: string[];
  participantDetails: { [key: string]: UserData };
  createdAt: Date;
  lastMessageTime?: Date;
  lastMessage?: {
    text?: string;
    senderId?: string;
    timestamp?: Timestamp;
  };
  typingUsers?: { [key: string]: boolean };
  draftMessages?: { [key: string]: string };
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
  const [retryCount, setRetryCount] = useState(0);
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

    let unsubscribe: (() => void) | null = null;

    try {
      setLoading(true);
      setError(null);

      // First verify Firestore connection and update user status
      const userRef: DocumentReference = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, {
        uid: currentUser.uid,
        email: currentUser.email,
        displayName: currentUser.displayName || 'Anonymous User',
        photoURL: currentUser.photoURL,
        lastSeen: serverTimestamp(),
        online: true,
      }, { merge: true }); // Use merge to preserve existing data

      const chatsRef = collection(db, 'chats');
      const q = query(
        chatsRef,
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc'),
        limit(50)
      );

      unsubscribe = (await loadChats()) || null;

      unsubscribe = onSnapshot(
        q,
        async (snapshot) => {
          try {
            const chatList: Chat[] = [];
            
            // Process all chats in parallel
            await Promise.all(snapshot.docs.map(async (doc) => {
              const data = doc.data();
              if (!data || !data.participants) {
                console.warn(`Invalid chat data for ${doc.id}:`, data);
                return;
              }

              // Get other participant's details if not already in the chat data
              const otherParticipantId = data.participants.find((id: string) => id !== currentUser.uid);
              if (otherParticipantId && (!data.participantDetails || !data.participantDetails[otherParticipantId])) {
                try {
                  const usersRef = collection(db, 'users');
                  const q = query(usersRef, where('uid', '==', otherParticipantId), limit(1));
                  const querySnapshot = await getDocs(q);
                  
                  if (!querySnapshot.empty) {
                    const userDoc = querySnapshot.docs[0];
                    const firestoreData = userDoc.data() as FirestoreUserData;
                    const userData: UserData = {
                      displayName: firestoreData.displayName || 'Anonymous User',
                      photoURL: firestoreData.photoURL || null,
                      email: firestoreData.email || '',
                      lastSeen: firestoreData.lastSeen || Timestamp.now(),
                      online: firestoreData.online || false,
                    };
                    data.participantDetails = {
                      ...data.participantDetails,
                      [otherParticipantId]: userData,
                    };
                  }
                } catch (err) {
                  console.error(`Error fetching user ${otherParticipantId}:`, err);
                }
              }

              // Convert timestamps to dates
              const createdAt = data.createdAt?.toDate?.() || new Date();
              const lastMessageTime = data.lastMessageTime?.toDate?.() || null;
              const lastMessageTimestamp = data.lastMessage?.timestamp;

              const chat: Chat = {
                id: doc.id,
                participants: data.participants,
                participantDetails: data.participantDetails || {},
                createdAt,
                lastMessageTime,
                lastMessage: data.lastMessage ? {
                  text: data.lastMessage.text || '',
                  senderId: data.lastMessage.senderId || '',
                  timestamp: lastMessageTimestamp,
                } : undefined,
                typingUsers: data.typingUsers || {},
                draftMessages: data.draftMessages || {},
              };

              chatList.push(chat);
            }));

            // Sort chats by last message time
            chatList.sort((a, b) => {
              const timeA = a.lastMessageTime?.getTime() || a.createdAt.getTime();
              const timeB = b.lastMessageTime?.getTime() || b.createdAt.getTime();
              return timeB - timeA;
            });

            console.log('Loaded chats:', chatList.length);
            setChats(chatList);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error('Error processing chats:', err);
            setError('Error processing chats. Please try again.');
            setLoading(false);
          }
        },
        (error) => {
          console.error('Error in chat subscription:', error);
          if (error.message.includes('requires an index')) {
            setError('Chat index is being created. Please wait a few minutes and try again.');
          } else {
            setError('Failed to load chats. Please try again.');
          }
          setLoading(false);
        }
      );

      return unsubscribe;
    } catch (error) {
      console.error('Error setting up chat listener:', error);
      setError('Failed to initialize chat listener. Please try again.');
      setLoading(false);
    }
  }, [currentUser?.uid]);

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const initializeChats = async () => {
      try {
        if (unsubscribe) {
          unsubscribe();
        }
        unsubscribe = (await loadChats()) || null;
      } catch (err) {
        console.error('Error initializing chats:', err);
        setError('Failed to initialize chats. Please try again.');
        setLoading(false);
      }
    };

    initializeChats();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [loadChats, retryCount]);

  const handleRetry = useCallback(() => {
    setRetryCount(count => count + 1);
  }, []);

  if (loading) {
    return (
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <div className="animate-pulse flex items-center justify-between">
            <div className="h-8 w-24 bg-gray-200 rounded"></div>
            <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="p-4 space-y-4">
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
      <div className="w-full md:w-80 bg-white border-r border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold">Chats</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
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
        <div className="flex items-center space-x-3">
          <UserAvatar
            user={currentUser}
            size={40}
          />
          <div>
            <h2 className="text-lg font-semibold">{currentUser.displayName ?? 'Anonymous User'}</h2>
            <p className="text-sm text-gray-500">{currentUser.email}</p>
          </div>
        </div>
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
                      {chat.lastMessage && typeof chat.lastMessage === 'object' && chat.lastMessage.text ? (
                        <>
                          {chat.lastMessage.text}
                        </>
                      ) : (
                        'No message'
                      )}
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
