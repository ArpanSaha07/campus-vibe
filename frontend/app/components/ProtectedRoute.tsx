'use client';

import { useAuth } from '@/app/lib/auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Home with the modal raised, rather than opening it in place: this
      // component renders null when signed out, so opening it here would put the
      // card over a blank page. `replace` so Back does not land them straight
      // back on the route they were just turned away from.
      router.replace('/?auth=login');
    }
  }, [isAuthenticated, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
