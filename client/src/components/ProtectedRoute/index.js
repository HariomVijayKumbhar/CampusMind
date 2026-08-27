import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';

/**
 * Route guard wrapper.
 * - Redirects unauthenticated users to /login.
 * - When adminOnly=true, verifies role via GET /api/auth/profile and redirects
 *   non-admins to /chat. The backend is authoritative for role checks.
 *
 * The profile is fetched ONCE and shared via the auth store, so this (and the
 * pages it wraps) never spam /api/auth/profile and trip the rate limiter.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const router = useRouter();
  const { session, loading } = useAuthStore();
  const profile = useAuthStore((state) => state.profile);
  const fetchProfile = useAuthStore((state) => state.fetchProfile);
  const [roleLoading, setRoleLoading] = useState(adminOnly);

  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.getState().initializeAuth();
    };

    initAuth();
  }, []);

  useEffect(() => {
    if (loading) return;

    if (!session) {
      router.push('/login');
      return;
    }

    if (adminOnly) {
      // Profile is the single shared source of truth (cached after first load).
      const verifyRole = async () => {
        try {
          const p = await fetchProfile();
          if (!p || p.role !== 'admin') {
            router.push('/chat');
          }
        } catch (error) {
          console.error('Failed to fetch user role:', error);
          router.push('/chat');
        } finally {
          setRoleLoading(false);
        }
      };

      verifyRole();
    } else {
      setRoleLoading(false);
    }
  }, [loading, session, adminOnly, router, fetchProfile]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  return children;
}
