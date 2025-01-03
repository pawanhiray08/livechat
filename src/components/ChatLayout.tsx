'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import UserList from './UserList';

export default function ChatLayout() {
  const { user } = useAuth();
  const [selectedChatId, setSelectedChatId] = useState<string | null>(() => {
    // Try to get the saved chat ID from localStorage
    if (typeof window !== 'undefined') {
      return localStorage.getItem('selectedChatId');
    }
    return null;
  });
  const [showUsers, setShowUsers] = useState(false);

  // Save selectedChatId to localStorage whenever it changes
  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem('selectedChatId', selectedChatId);
    } else {
      localStorage.removeItem('selectedChatId');
    }
  }, [selectedChatId]);

  if (!user) return null;

  const handleBackToChats = () => {
    setSelectedChatId(null);
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar - hidden on mobile when chat is selected */}
      <div 
        className={`${
          selectedChatId ? 'hidden md:block' : 'block'
        } w-full md:w-80 flex-shrink-0 border-r border-gray-200 bg-white`}
      >
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

      {/* Chat Window - full screen on mobile when selected */}
      {selectedChatId && (
        <div className={`${
          selectedChatId ? 'block' : 'hidden md:block'
        } flex-1 flex flex-col`}>
          <div className="md:hidden bg-white border-b border-gray-200">
            <button
              onClick={handleBackToChats}
              className="p-4 text-blue-500 hover:text-blue-600 flex items-center space-x-2"
            >
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-5 w-5" 
                viewBox="0 0 20 20" 
                fill="currentColor"
              >
                <path 
                  fillRule="evenodd" 
                  d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" 
                  clipRule="evenodd" 
                />
              </svg>
              <span>Back to Chats</span>
            </button>
          </div>
          <ChatWindow chatId={selectedChatId} currentUser={user} />
        </div>
      )}
    </div>
  );
}
