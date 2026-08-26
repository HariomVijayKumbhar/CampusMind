import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

/**
 * Profile page: shows name, email, and role; includes logout.
 * Role comes from the backend profiles table (source of truth).
 */
export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        // Backend returns { id, full_name, role, created_at }
        const response = await api.get('/api/auth/profile');
        setProfile(response.data);
      } catch (err) {
        console.error('Failed to fetch profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchProfile();
  }, []);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-2xl px-4 py-12">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="mb-6 flex items-center justify-between">
              <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
              <Link href="/chat" className="text-sm text-blue-600 hover:text-blue-500">
                Back to Chat
              </Link>
            </div>

            {loadingProfile ? (
              <p className="py-8 text-center text-sm text-gray-500">
                Loading profile...
              </p>
            ) : (
              <div className="space-y-6">
                <div>
                  <h2 className="mb-4 text-lg font-medium text-gray-900">Profile</h2>
                  <dl className="space-y-4">
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Name</dt>
                      <dd className="mt-1 text-gray-900">
                        {profile?.full_name || 'N/A'}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Email</dt>
                      <dd className="mt-1 text-gray-900">{profile?.email || 'N/A'}</dd>
                    </div>
                    <div>
                      <dt className="text-sm font-medium text-gray-700">Role</dt>
                      <dd className="mt-1">
                        <span className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-800">
                          {profile?.role || 'student'}
                        </span>
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <SignOutButton />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}

function SignOutButton() {
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    try {
      await useAuthStore.getState().logout();
      window.location.href = '/login';
    } catch (error) {
      console.error('Logout failed:', error);
      setSigningOut(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={signingOut}
      className="w-full rounded-md bg-red-600 py-2 px-4 font-medium text-white hover:bg-red-700 disabled:opacity-50"
    >
      {signingOut ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
