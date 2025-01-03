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

  const handleBackToChats = useCallback(() => {
    setSelectedChatId(null);
    setShowUsers(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '/');
    }
  }, []);

  const handleChatSelect = useCallback((chatId: string) => {
    setSelectedChatId(chatId);
    if (typeof window !== 'undefined') {
      window.history.pushState({ chatId }, '', `/chat/${chatId}`);
    }
  }, []);

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <ChatSidebar
        currentUser={user}
        selectedChatId={selectedChatId}
        onChatSelect={handleChatSelect}
        onShowSettings={() => setShowSettings(true)}
        onShowSearch={() => setShowSearch(true)}
      />
      
      {selectedChatId ? (
        <ChatWindow
          chatId={selectedChatId}
          currentUser={user}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-500">Select a chat to start messaging</p>
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

      {/* Search Modal */}
      {showSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-md m-4">
            <div className="flex justify-between items-center p-4 border-b">
              <h2 className="text-xl font-semibold">Find Users</h2>
              <button
                onClick={() => setShowSearch(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ×
              </button>
            </div>
            <div className="p-4">
              <UserSearch onClose={() => setShowSearch(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
