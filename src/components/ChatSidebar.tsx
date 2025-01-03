'use client';

import { useEffect, useState } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import UserAvatar from './UserAvatar';
import { Chat } from '@/types';

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

  useEffect(() => {
    // Query chats where the current user is a participant
    const chatsRef = collection(db, 'chats');
    const q = query(
      chatsRef,
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageTime', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const chatList: ChatWithId[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          // Find the other participant
          const otherParticipantId = data.participants.find(
            (id: string) => id !== currentUser.uid
          );

          if (otherParticipantId && data.participantDetails) {
            chatList.push({
              id: doc.id,
              participants: data.participants,
              participantDetails: data.participantDetails,
              createdAt: data.createdAt ? (data.createdAt as Timestamp).toDate() : new Date(),
              lastMessageTime: data.lastMessageTime ? (data.lastMessageTime as Timestamp).toDate() : new Date(),
              lastMessage: data.lastMessage || null,
            });
          }
        });
        setChats(chatList);
        setLoading(false);
      },
      (error) => {
        console.error('Error fetching chats:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser.uid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <div className="text-gray-500">Loading chats...</div>
      </div>
    );
  }

  if (chats.length === 0) {
    return (
      <div className="text-center py-4 text-gray-500">
        No chats yet. Start a new chat by clicking "Show Users"
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {chats.map((chat) => {
        const otherParticipantId = chat.participants.find(
          (id) => id !== currentUser.uid
        )!;
        const otherParticipant = chat.participantDetails[otherParticipantId];

        return (
          <button
            key={chat.id}
            onClick={() => onChatSelect(chat.id)}
            className={`w-full text-left p-3 rounded-lg transition-colors ${
              selectedChatId === chat.id
                ? 'bg-blue-50'
                : 'hover:bg-gray-50'
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
              />
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
                {chat.lastMessage && (
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage}
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
