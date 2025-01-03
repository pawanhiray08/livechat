'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import UserList from './UserList';

export default function ChatLayout() {
  const [showUsers, setShowUsers] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Load selected chat from localStorage
    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId) {
      setSelectedChatId(savedChatId);
    }

    // Handle browser back button
    const handlePopState = (event: PopStateEvent) => {
      if (event.state?.chatId) {
        setSelectedChatId(event.state.chatId);
        setShowUsers(false);
      } else {
        setSelectedChatId(null);
        setShowUsers(false);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Save selected chat to localStorage whenever it changes
  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem('selectedChatId', selectedChatId);
    } else {
      localStorage.removeItem('selectedChatId');
    }
  }, [selectedChatId]);

  const handleBackToChats = () => {
    setSelectedChatId(null);
    setShowUsers(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile header - only shown when chat is selected */}
      {selectedChatId && (
        <div className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 flex items-center px-4 md:hidden z-10">
          <button
            onClick={handleBackToChats}
            className="mr-4 text-gray-600 hover:text-gray-900"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h2 className="text-lg font-semibold">Back to Chats</h2>
        </div>
      )}

      {/* Sidebar - hidden on mobile when chat is selected */}
      <div 
        className={`${
          selectedChatId ? 'hidden md:block' : 'block'
        } w-full md:w-80 flex-shrink-0 border-r border-gray-200 bg-white h-full overflow-hidden`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-semibold">
              {showUsers ? 'New Chat' : 'Recent Chats'}
            </h1>
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="text-blue-500 hover:text-blue-600 text-sm font-medium"
              data-show-users
            >
              {showUsers ? 'Show Chats' : 'New Chat'}
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            {showUsers ? (
              <UserList 
                currentUser={user} 
                onChatCreated={(chatId) => {
                  setSelectedChatId(chatId);
                  setShowUsers(false);
                  if (typeof window !== 'undefined') {
                    window.history.pushState({ chatId }, '');
                  }
                }}
              />
            ) : (
              <ChatSidebar 
                currentUser={user} 
                selectedChatId={selectedChatId} 
                onChatSelect={(chatId) => {
                  setSelectedChatId(chatId);
                  if (typeof window !== 'undefined') {
                    window.history.pushState({ chatId }, '');
                  }
                }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Main chat area - full screen on mobile when chat is selected */}
      <div 
        className={`${
          selectedChatId ? 'block' : 'hidden md:block'
        } flex-1 h-full ${selectedChatId ? 'md:pt-0 pt-14' : ''}`}
      >
        {selectedChatId ? (
          <ChatWindow chatId={selectedChatId} currentUser={user} />
        ) : (
          <div className="h-full flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-gray-600 mb-2">Welcome to Chat</h2>
              <p className="text-gray-500">Select a chat or start a new conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
