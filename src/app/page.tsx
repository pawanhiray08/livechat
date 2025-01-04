'use client';

import { useAuth } from '@/lib/auth';
import LoginPage from '@/components/LoginPage';
import ChatLayout from '@/components/ChatLayout';
import { useEffect } from 'react';

export default function Home() {
  const { user, loading } = useAuth();
  
  useEffect(() => {
    console.log('Home component state:', { user, loading });
  }, [user, loading]);

  if (loading) {
    console.log('Rendering loading state');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  if (!user) {
    console.log('Rendering login page');
    return <LoginPage />;
  }

  console.log('Rendering chat layout');
  return <ChatLayout />;
}
