'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';

export default function ChatLayout() {
  const { user } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);

  if (!user) return null;

  return (
    <div className="flex h-screen">
      <ChatSidebar
        currentUser={user}
        selectedChatId={selectedChatId}
        onChatSelect={setSelectedChatId}
      />
      <main className="flex-1">
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
