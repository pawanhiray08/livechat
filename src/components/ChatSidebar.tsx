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
}

interface ChatWithId extends Chat {
  id: string;
}

export default function ChatSidebar({
  currentUser,
  selectedChatId,
  onChatSelect,
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
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (docSnapshot) => {
        console.log('Fetching chats...');
        const chatList: Chat[] = [];
        const seenChats = new Set<string>();

        for (const doc of docSnapshot.docs) {
          const data = doc.data() as DocumentData;
          console.log('Chat data:', data);

          const otherParticipantId = data.participants.find(
            (id: string) => id !== currentUser.uid
          );

          if (otherParticipantId && !seenChats.has(doc.id)) {
            // Fetch participant details if not present
            if (!data.participantDetails || !data.participantDetails[otherParticipantId]) {
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
                  data.participantDetails = {
                    ...data.participantDetails,
                    [otherParticipantId]: typedUserData
                  };
                  // Update the chat document with participant details
                  await updateDoc(doc(db, 'chats', doc.ref.id), {
                    participantDetails: data.participantDetails,
                  });
                }
              } catch (error) {
                console.error('Error fetching participant details:', error);
              }
            }

            if (data.participantDetails?.[otherParticipantId]) {
              seenChats.add(doc.id);
              const chat = {
                id: doc.id,
                participants: data.participants,
                participantDetails: data.participantDetails,
                lastMessage: data.lastMessage || '',
                lastMessageTime: data.lastMessageTime ? (data.lastMessageTime as Timestamp).toDate() : null,
                createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
                typingUsers: data.typingUsers || {},
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
  );
}
