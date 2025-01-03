'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import UserList from './UserList';

export default function ChatLayout() {
  const { user } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [showUsers, setShowUsers] = useState(false);

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <div className="w-80 flex-shrink-0 border-r border-gray-200 bg-gray-50">
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold">Chats</h1>
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
            >
              {showUsers ? 'Show Chats' : 'Show Users'}
            </button>
          </div>
          {showUsers ? (
            <UserList 
              currentUser={user} 
              onChatCreated={(chatId) => {
                setSelectedChatId(chatId);
                setShowUsers(false);
              }}
            />
          ) : (
            <ChatSidebar
              currentUser={user}
              selectedChatId={selectedChatId}
              onChatSelect={setSelectedChatId}
            />
          )}
        </div>
      </div>
      <main className="flex-1 bg-white">
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} currentUser={user} />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            Select a chat or start a new conversation
          </div>
        )}
      </main>
    </div>
  );
}
