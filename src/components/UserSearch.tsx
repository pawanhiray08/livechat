'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import Image from 'next/image';

interface UserSearchProps {
  onClose: () => void;
}

export default function UserSearch({ onClose }: UserSearchProps) {
  const { searchUsers } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.trim()) {
      setIsLoading(true);
      try {
        const results = await searchUsers(value.trim());
        setSearchResults(results);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsLoading(false);
      }
    } else {
      setSearchResults([]);
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={handleSearch}
          placeholder="Search users by username..."
          className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {isLoading && (
          <div className="absolute right-3 top-2.5">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
          </div>
        )}
      </div>

      {searchResults.length > 0 && (
        <div className="mt-4 space-y-2">
          {searchResults.map((user) => (
            <div
              key={user.uid}
              className="flex items-center space-x-4 p-3 bg-white rounded-lg shadow hover:bg-gray-50 transition-colors"
            >
              <div className="relative w-10 h-10">
                <Image
                  src={user.photoURL || '/default-avatar.png'}
                  alt={user.username}
                  fill
                  className="rounded-full object-cover"
                />
              </div>
              <div>
                <p className="font-medium">{user.username}</p>
                <p className="text-sm text-gray-500">{user.displayName}</p>
              </div>
              <div className="ml-auto">
                {user.online ? (
                  <span className="inline-block w-2 h-2 bg-green-500 rounded-full"></span>
                ) : (
                  <span className="inline-block w-2 h-2 bg-gray-300 rounded-full"></span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
