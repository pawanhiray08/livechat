import Image from 'next/image';
import { cn } from '@/lib/utils';

interface AvatarUser {
  displayName: string | null;
  photoURL: string | null;
  email: string | null;
}

interface UserAvatarProps {
  user: AvatarUser;
  className?: string;
  children?: React.ReactNode;
}

export default function UserAvatar({ user, className, children }: UserAvatarProps) {
  if (!user?.photoURL) {
    return (
      <div
        className={cn(
          'rounded-full bg-gray-200 flex items-center justify-center text-gray-500',
          className
        )}
      >
        {user?.displayName?.[0] || user?.email?.[0] || '?'}
        {children}
      </div>
    );
  }

  return (
    <div className={cn('rounded-full overflow-hidden', className)}>
      <Image
        src={user.photoURL}
        alt={user.displayName || 'User avatar'}
        width={40}
        height={40}
        className="object-cover w-full h-full"
      />
      {children}
    </div>
  );
}
