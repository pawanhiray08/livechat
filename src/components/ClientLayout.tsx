'use client';

import { AuthProvider } from '@/lib/auth';
import ErrorBoundary from '@/components/ErrorBoundary';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <AuthProvider>{children}</AuthProvider>
    </ErrorBoundary>
  );
}
