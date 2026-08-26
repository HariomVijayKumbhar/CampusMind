import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useEffect, useState } from 'react';

/**
 * Route guard wrapper.
 * - Redirects unauthenticated users to /login.
 * - When adminOnly=true, verifies role via GET /api/auth/profile and redirects
 *   non-admins to /chat. The backend is authoritative for role checks.
 */
export default function ProtectedRoute({ children, adminOnly = false }) {
  const router = useRouter();
  const { session, loading } = useAuthStore();
  const [userRole, setUserRole] = useState(null);
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
      // Fetch role from backend (source of truth)
      const fetchRole = async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/auth/profile`,
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          );

          if (response.ok) {
            const profile = await response.json();
            setUserRole(profile.role);
            if (profile.role !== 'admin') {
              router.push('/chat');
            }
          } else {
            router.push('/chat');
          }
        } catch (error) {
          console.error('Failed to fetch user role:', error);
          router.push('/chat');
        } finally {
          setRoleLoading(false);
        }
      };

      fetchRole();
    } else {
      setRoleLoading(false);
    }
  }, [loading, session, adminOnly, router]);

  if (loading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-gray-500">
        Loading...
      </div>
    );
  }

  return children;
}
