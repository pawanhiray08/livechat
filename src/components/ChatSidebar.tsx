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
}

interface ChatWithId extends Chat {
  id: string;
}

export default function ChatSidebar({
  currentUser,
  selectedChatId,
  onChatSelect,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<ChatWithId[]>([]);
  const [loading, setLoading] = useState(true);
  const parentRef = useRef<HTMLDivElement>(null);

  // Create virtualizer for chat list
  const rowVirtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: useCallback(() => 80, []), // Estimate each chat item height
    overscan: 5, // Number of items to render outside of the visible area
  });

  useEffect(() => {
    // Query chats where the current user is a participant
    console.log('Fetching chats for user:', currentUser.uid);
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('createdAt', 'desc'), // Change to createdAt since we always have this field
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      try {
        console.log('Got chats snapshot, size:', snapshot.size);
        const chatList: ChatWithId[] = [];
        const seenChats = new Set<string>();

        snapshot.forEach((doc) => {
          console.log('Processing chat doc:', doc.id, doc.data());
          const data = doc.data();
          const otherParticipantId = data.participants.find(
            (id: string) => id !== currentUser.uid
          );

          if (otherParticipantId && data.participantDetails && !seenChats.has(doc.id)) {
            seenChats.add(doc.id);
            const chat = {
              id: doc.id,
              participants: data.participants,
              participantDetails: data.participantDetails,
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
              lastMessageTime: data.lastMessageTime ? (data.lastMessageTime as Timestamp).toDate() : new Date(),
              lastMessage: data.lastMessage || '',
              typingUsers: data.typingUsers || {},
            };
            chatList.push(chat);
          }
        });

        console.log('Final chat list:', chatList);
        setChats(chatList);
        setLoading(false);
      } catch (error) {
        console.error('Error processing chat data:', error);
        setLoading(false);
      }
    }, (error) => {
      console.error('Error in chat subscription:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
        <p className="text-gray-500 mb-4">No chats yet</p>
        <button
          onClick={() => document.querySelector<HTMLButtonElement>('[data-show-users]')?.click()}
          className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
        >
          Start a New Chat
        </button>
      </div>
    );
  }

  return (
    <div 
      ref={parentRef} 
      className="space-y-2 overflow-auto"
      style={{ height: 'calc(100vh - 100px)' }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const chat = chats[virtualRow.index];
        const otherParticipantId = chat.participants.find(
          (id) => id !== currentUser.uid
        )!;
        const otherParticipant = chat.participantDetails[otherParticipantId];

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
              <UserAvatar
                user={{
                  displayName: otherParticipant.displayName,
                  photoURL: otherParticipant.photoURL,
                  email: otherParticipant.email,
                }}
                className="h-10 w-10"
              >
                {otherParticipant.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-white rounded-full"></span>
                )}
              </UserAvatar>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="font-medium text-sm truncate">
                    {otherParticipant.displayName}
                  </p>
                  {chat.lastMessageTime && (
                    <span className="text-xs text-gray-400 ml-2">
                      {new Date(chat.lastMessageTime).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-baseline">
                  {chat.lastMessage && (
                    <p className="text-sm text-gray-500 truncate flex-1">
                      {chat.lastMessage}
                    </p>
                  )}
                  <span className="text-xs text-gray-400 ml-2">
                    {formatLastSeen(
                      otherParticipant.lastSeen ? new Date(otherParticipant.lastSeen) : null,
                      otherParticipant.online
                    )}
                  </span>
                </div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
