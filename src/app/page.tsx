'use client';

import { useAuth } from '@/lib/auth';
import LoginPage from '@/components/LoginPage';
import ChatLayout from '@/components/ChatLayout';

export default function Home() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  return <ChatLayout />;
}
