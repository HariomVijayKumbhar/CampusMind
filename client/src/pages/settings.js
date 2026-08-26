import { useState, useEffect } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useAuthStore } from '@/store/authStore';
import api from '@/services/api';

export default function Settings() {
  const [profile, setProfile] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
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

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <ProtectedRoute>
      <Head>
        <title>Account Settings — CampusMind</title>
        <meta name="description" content="View your CampusMind profile details and account settings." />
      </Head>

      <div className="min-h-screen px-4 py-8 sm:px-6 sm:py-12" style={{ background: 'rgb(15,15,23)' }}>
        <div className="mx-auto max-w-xl space-y-6">
          {/* Top Bar */}
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight text-white">Settings</h1>
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition-all hover:border-violet-500/40 hover:bg-white/10 hover:text-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd"/>
              </svg>
              Back to Chat
            </Link>
          </div>

          {/* Profile Card */}
          <div
            className="overflow-hidden rounded-2xl border border-white/10 p-6 sm:p-8"
            style={{ background: 'rgba(22,22,34,0.75)', backdropFilter: 'blur(16px)' }}
          >
            {loadingProfile ? (
              <div className="flex justify-center items-center py-12 gap-3">
                <svg className="h-5 w-5 animate-spin text-violet-400" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                <span className="text-sm text-slate-400">Loading profile...</span>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Header with avatar */}
                <div className="flex items-center gap-4 border-b border-white/10 pb-6">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl text-xl font-bold text-white shadow-xl"
                    style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))' }}
                  >
                    {initials}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">{profile?.full_name || 'User'}</h2>
                    <p className="text-sm text-slate-400">{profile?.email || ''}</p>
                  </div>
                </div>

                {/* Details */}
                <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Full Name</dt>
                    <dd className="mt-1 text-sm font-medium text-white">{profile?.full_name || 'N/A'}</dd>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email Address</dt>
                    <dd className="mt-1 text-sm font-medium text-white">{profile?.email || 'N/A'}</dd>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role</dt>
                    <dd className="mt-1">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-500/15 border border-violet-500/25 px-3 py-0.5 text-xs font-semibold capitalize text-violet-300">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400" />
                        {profile?.role || 'student'}
                      </span>
                    </dd>
                  </div>

                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-slate-500">Member Since</dt>
                    <dd className="mt-1 text-sm font-medium text-white">
                      {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'N/A'}
                    </dd>
                  </div>
                </dl>

                {/* Sign Out Button */}
                <div className="border-t border-white/10 pt-6">
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
      id="settings-signout"
      type="button"
      onClick={handleLogout}
      disabled={signingOut}
      className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-300 transition-all hover:bg-red-500/20 hover:text-red-200 disabled:opacity-50"
    >
      {signingOut ? (
        <>
          <svg className="h-4 w-4 animate-spin text-red-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
          </svg>
          Signing out...
        </>
      ) : (
        <>
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25z" clipRule="evenodd"/>
            <path fillRule="evenodd" d="M19 10a.75.75 0 00-.75-.75H8.704l1.048-1.07a.75.75 0 10-1.004-1.115l-2.5 2.5a.75.75 0 000 1.07l2.5 2.5a.75.75 0 101.004-1.114L8.704 10.75H18.25A.75.75 0 0019 10z" clipRule="evenodd"/>
          </svg>
          Sign Out
        </>
      )}
    </button>
  );
}
