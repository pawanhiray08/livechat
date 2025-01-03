'use client';

import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import NewChat from './NewChat';
import UserAvatar from './UserAvatar';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  currentUser: User;
  selectedChatId: string | null;
  onChatSelect: (chatId: string) => void;
}

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: {
    text: string;
    senderId: string;
    timestamp: any;
  };
}

interface ChatUser {
  uid: string;
  displayName: string;
  photoURL: string;
  email: string;
}

export default function ChatSidebar({
  currentUser,
  selectedChatId,
  onChatSelect,
}: ChatSidebarProps) {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<Record<string, ChatUser>>({});

  // Fetch chats
  useEffect(() => {
    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageTime', 'desc')
    );

    return onSnapshot(q, (snapshot) => {
      const chatList: Chat[] = [];
      snapshot.forEach((doc) => {
        chatList.push({ id: doc.id, ...doc.data() } as Chat);
      });
      setChats(chatList);

      // Fetch users for all participants
      const userIds = new Set<string>();
      chatList.forEach((chat) => {
        chat.participants.forEach((id) => userIds.add(id));
      });

      userIds.forEach(async (uid) => {
        if (!users[uid]) {
          const userDoc = await getDocs(query(collection(db, 'users'), where('uid', '==', uid)));
          if (!userDoc.empty) {
            const userData = userDoc.docs[0].data() as ChatUser;
            setUsers((prev) => ({ ...prev, [uid]: userData }));
          }
        }
      });
    });
  }, [currentUser.uid]);

  return (
    <div className="w-80 flex flex-col border-r border-gray-200 bg-white">
      <div className="p-4 border-b">
        <NewChat currentUser={currentUser} />
      </div>
      <div className="flex-1 overflow-y-auto">
        {chats.map((chat) => {
          const otherParticipant = users[
            chat.participants.find((id) => id !== currentUser.uid) || ''
          ];

          return (
            <button
              key={chat.id}
              onClick={() => onChatSelect(chat.id)}
              className={cn(
                'w-full p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors',
                selectedChatId === chat.id && 'bg-blue-50 hover:bg-blue-50'
              )}
            >
              {otherParticipant && (
                <UserAvatar
                  user={otherParticipant}
                  className="flex-shrink-0"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {otherParticipant?.displayName || 'Loading...'}
                  </p>
                  {chat.lastMessage && (
                    <p className="text-xs text-gray-500">
                      {new Date(chat.lastMessage.timestamp?.toDate()).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  )}
                </div>
                {chat.lastMessage && (
                  <p className="text-sm text-gray-500 truncate">
                    {chat.lastMessage.text}
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
