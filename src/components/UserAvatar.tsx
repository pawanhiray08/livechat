'use client';

import Image from 'next/image';

interface UserAvatarProps {
  user: {
    photoURL: string | null;
    displayName: string | null;
  };
  size?: number;
  className?: string;
}

export default function UserAvatar({ user, size = 40, className = '' }: UserAvatarProps) {
  const initials = user.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
    : '?';

  if (user.photoURL) {
    return (
      <div
        className={`relative overflow-hidden rounded-full ${className}`}
        style={{ width: size, height: size }}
      >
        <Image
          src={user.photoURL}
          alt={user.displayName || 'User Avatar'}
          className="object-cover"
          fill
          sizes={`${size}px`}
        />
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full bg-blue-500 text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(size * 0.4, 14),
      }}
    >
      {initials}
    </div>
  );
}
