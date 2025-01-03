'use client';

import { useAuth } from '@/lib/auth';
import Image from 'next/image';
import { useState } from 'react';

export default function LoginPage() {
  const { signInWithGoogle, loading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      await signInWithGoogle();
    } catch (err) {
      setError('Failed to sign in with Google. Please try again.');
      console.error('Sign in error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-bold text-gray-900">Welcome to Realtime Chat</h2>
          <p className="mt-2 text-sm text-gray-600">Sign in to start chatting</p>
        </div>

        {error && (
          <div className="bg-red-50 p-4 rounded-md">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        <button
          onClick={handleSignIn}
          disabled={isLoading || authLoading}
          className={`w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
            (isLoading || authLoading) ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {(isLoading || authLoading) ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Signing in...
            </>
          ) : (
            <>
              <Image
                src="/google.svg"
                alt="Google Logo"
                width={20}
                height={20}
                className="mr-2"
              />
              Sign in with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}
