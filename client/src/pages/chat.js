import { useState, useEffect } from 'react';
import Link from 'next/link';
import ProtectedRoute from '@/components/ProtectedRoute';
import ChatWindow from '@/components/ChatWindow';
import api from '@/services/api';

/**
 * Main chat page. Minimal top bar (per spec: single centered chat column,
 * no sidebar chrome) with conditional admin link based on the user's role.
 */
export default function Chat() {
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await api.get('/api/auth/profile');
        setProfile(response.data);
      } catch (err) {
        // Non-fatal: admin link simply won't show
        console.error('Failed to fetch profile:', err);
      }
    };

    fetchProfile();
  }, []);

  return (
    <ProtectedRoute>
      <div className="flex h-screen flex-col bg-gray-50">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/chat" className="text-lg font-bold text-gray-900">
              CampusMind
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              {profile?.role === 'admin' && (
                <Link
                  href="/admin/documents"
                  className="text-gray-600 hover:text-gray-900"
                >
                  Manage Documents
                </Link>
              )}
              <Link
                href="/settings"
                className="text-gray-600 hover:text-gray-900"
              >
                Settings
              </Link>
            </nav>
          </div>
        </header>

        <div className="min-h-0 flex-1">
          <ChatWindow />
        </div>
      </div>
    </ProtectedRoute>
  );
}
