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
  getDoc,
  updateDoc,
  doc,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Chat } from '@/types';
import { formatLastSeen } from '@/utils/time';
import { useVirtualizer } from '@tanstack/react-virtual';

interface FirebaseUser {
  uid: string;
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  lastSeen: Timestamp | null;
  online: boolean;
}

interface FirestoreUser {
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
  lastSeen: Timestamp | null;
  online: boolean;
}

interface ChatSidebarProps {
  currentUser: User;
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
  onShowSettings: () => void;
  onShowSearch: () => void;
}

interface ChatWithId extends Chat {
  id: string;
}

export default function ChatSidebar({
  currentUser,
  selectedChatId,
  onChatSelect,
  onShowSettings,
  onShowSearch,
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
    if (!currentUser?.uid) return;

    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        console.log('Fetching chats...');
        const chatList: Chat[] = [];
        const seenChats = new Set<string>();

        for (const chatDoc of snapshot.docs) {
          const chatData = chatDoc.data() as DocumentData;
          console.log('Chat data:', chatData);

          const otherParticipantId = chatData.participants.find(
            (id: string) => id !== currentUser.uid
          );

          if (otherParticipantId && !seenChats.has(chatDoc.id)) {
            // Fetch participant details if not present
            if (!chatData.participantDetails || !chatData.participantDetails[otherParticipantId]) {
              try {
                const userDocRef = doc(db, 'users', otherParticipantId);
                const userDocSnapshot = await getDoc(userDocRef);
                if (userDocSnapshot.exists()) {
                  const userData = userDocSnapshot.data() as FirestoreUser;
                  const typedUserData: FirebaseUser = {
                    uid: otherParticipantId,
                    displayName: userData.displayName || '',
                    photoURL: userData.photoURL || '',
                    email: userData.email || '',
                    lastSeen: userData.lastSeen || null,
                    online: userData.online || false
                  };
                  chatData.participantDetails = {
                    ...chatData.participantDetails,
                    [otherParticipantId]: typedUserData
                  };
                  // Update the chat document with participant details
                  await updateDoc(doc(db, 'chats', chatDoc.ref.id), {
                    participantDetails: chatData.participantDetails,
                  });
                }
              } catch (error) {
                console.error('Error fetching participant details:', error);
              }
            }

            if (chatData.participantDetails?.[otherParticipantId]) {
              seenChats.add(chatDoc.id);
              const chat = {
                id: chatDoc.id,
                participants: chatData.participants,
                participantDetails: chatData.participantDetails,
                lastMessage: chatData.lastMessage || null,
                lastMessageTime: chatData.lastMessageTime ? (chatData.lastMessageTime as Timestamp).toDate() : null,
                createdAt: chatData.createdAt ? (chatData.createdAt as Timestamp).toDate() : new Date(),
                typingUsers: chatData.typingUsers || {},
                draftMessages: chatData.draftMessages || {},
              };
              chatList.push(chat);
            }
          }
        }

        console.log('Final chat list:', chatList);
        setChats(chatList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching chats:', error);
        setError('Failed to load chats');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center text-red-500 p-4">
        {error}
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center text-gray-500 p-4">
        No chats yet. Start a new conversation!
      </div>
    );
  }

  return (
    <div className="w-80 h-full border-r border-gray-200 bg-white flex flex-col">
      {/* Header with user info and actions */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <UserAvatar
              user={{
                displayName: currentUser.displayName,
                photoURL: currentUser.photoURL,
                email: currentUser.email
              }}
              className="w-10 h-10"
            />
            <div>
              <h2 className="font-semibold">{currentUser.displayName}</h2>
              <p className="text-sm text-gray-500">{currentUser.email}</p>
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={onShowSearch}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Find Users
          </button>
          <button
            onClick={onShowSettings}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>

      {/* Chat list */}
      <div 
        ref={parentRef} 
        className="h-full overflow-auto"
      >
        <div className="space-y-2">
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const chat = chats[virtualRow.index];
            const otherParticipantId = chat.participants.find(
              (id) => id !== currentUser.uid
            );
            const otherParticipant = otherParticipantId ? chat.participantDetails[otherParticipantId] : null;

            if (!otherParticipant) {
              console.error('Could not find other participant details for chat:', chat.id);
              return null;
            }

            // Convert Firestore timestamp to Date if it exists
            const lastSeen = otherParticipant.lastSeen 
              ? (otherParticipant.lastSeen as unknown as Timestamp).toDate()
              : null;

            return (
              <button
                key={chat.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                onClick={() => onChatSelect(chat.id)}
                className={`w-full text-left p-3 rounded-lg transition-colors ${
                  selectedChatId === chat.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="relative flex-shrink-0">
                    <UserAvatar
                      user={{
                        displayName: otherParticipant.displayName || 'Unknown User',
                        photoURL: otherParticipant.photoURL,
                        email: otherParticipant.email || '',
                      }}
                      className="h-12 w-12 md:h-10 md:w-10"
                    />
                    {otherParticipant.online && (
                      <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <p className="font-medium text-base md:text-sm truncate">
                        {otherParticipant.displayName || 'Unknown User'}
                      </p>
                      {chat.lastMessageTime && (
                        <span className="text-xs text-gray-400 ml-2 whitespace-nowrap">
                          {new Date(chat.lastMessageTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between items-baseline">
                      <div className="flex-1 min-w-0">
                        {chat.lastMessage ? (
                          <p className="text-sm text-gray-500 truncate">
                            {chat.lastMessage}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-400 italic">
                            No messages yet
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-gray-400 ml-2 whitespace-nowrap hidden md:inline">
                        {formatLastSeen(lastSeen, otherParticipant.online)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
