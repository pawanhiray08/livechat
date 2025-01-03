import Image from 'next/image';
import { User } from 'firebase/auth';
import { cn } from '@/lib/utils';

interface UserAvatarProps {
  user: User | null;
  className?: string;
}

export default function UserAvatar({ user, className }: UserAvatarProps) {
  if (!user?.photoURL) {
    return (
      <div
        className={cn(
          'h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500',
          className
        )}
      >
        {user?.displayName?.[0] || user?.email?.[0] || '?'}
      </div>
    );
  }

  return (
    <div className={cn('h-10 w-10 rounded-full overflow-hidden', className)}>
      <Image
        src={user.photoURL}
        alt={user.displayName || 'User avatar'}
        width={40}
        height={40}
        className="object-cover"
      />
    </div>
  );
}
