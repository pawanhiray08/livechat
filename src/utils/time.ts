export function formatLastSeen(date: Date | null): string {
  if (!date) return 'Never';

  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return 'Online';
  if (seconds < 60) return 'Last seen just now';
  if (minutes === 1) return 'Last seen 1 minute ago';
  if (minutes < 60) return `Last seen ${minutes} minutes ago`;
  if (hours === 1) return 'Last seen 1 hour ago';
  if (hours < 24) return `Last seen ${hours} hours ago`;
  if (days === 1) return 'Last seen yesterday';
  if (days < 7) return `Last seen ${days} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
  });
}
