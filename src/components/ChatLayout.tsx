'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth';
import ChatSidebar from './ChatSidebar';
import ChatWindow from './ChatWindow';
import UserList from './UserList';
import ProfileSettings from './ProfileSettings';
import UserSearch from './UserSearch';

export default function ChatLayout() {
  const [showUsers, setShowUsers] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    // Load selected chat from localStorage
    const savedChatId = localStorage.getItem('selectedChatId');
    if (savedChatId) {
      setSelectedChatId(savedChatId);
    }
  }, []);

  // Save selected chat to localStorage whenever it changes
  useEffect(() => {
    if (selectedChatId) {
      localStorage.setItem('selectedChatId', selectedChatId);
    } else {
      localStorage.removeItem('selectedChatId');
    }
  }, [selectedChatId]);

  const handleChatCreated = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    setShowUsers(false);
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Left Sidebar - Chat List or User List */}
      {showUsers ? (
        <div className="w-80 bg-white border-r border-gray-200 flex flex-col">
          <div className="p-4 flex justify-between items-center border-b border-gray-200">
            <h2 className="text-xl font-semibold">Users</h2>
            <button
              onClick={() => setShowUsers(false)}
              className="p-2 hover:bg-gray-100 rounded-full"
              title="Back to Chats"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <UserList currentUser={user} onChatCreated={handleChatCreated} />
          </div>
        </div>
      ) : (
        <ChatSidebar
          currentUser={user}
          selectedChatId={selectedChatId}
          onChatSelect={setSelectedChatId}
          onShowUsers={() => setShowUsers(true)}
          onShowSettings={() => setShowSettings(true)}
          onShowSearch={() => setShowSearch(true)}
        />
      )}

      {/* Main Chat Window */}
      {selectedChatId ? (
        <ChatWindow
          chatId={selectedChatId}
          currentUser={user}
          onClose={() => setSelectedChatId(null)}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-white">
          <div className="text-center">
            <h3 className="text-xl font-medium text-gray-900 mb-2">Welcome to Chat</h3>
            <p className="text-gray-500 mb-4">Select a chat or start a new conversation</p>
            {!showUsers && (
              <button
                onClick={() => setShowUsers(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Find Users
              </button>
            )}
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md m-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Profile Settings</h2>
              <button
                onClick={() => setShowSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <ProfileSettings onClose={() => setShowSettings(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
