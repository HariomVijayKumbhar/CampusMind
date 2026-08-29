import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '@/services/supabaseClient';

const SUPABASE_NOT_CONFIGURED_ERROR =
  'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in client/.env.local and restart the Next.js dev server.';

export const useAuthStore = create((set, get) => ({
  session: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('authSession') || 'null') : null,
  user: null,
  profile: null,
  loading: true,

  fetchProfile: async (force = false) => {
    const { profile, session } = get();
    if (profile && !force) return profile;
    if (!session?.access_token) return null;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/profile`,
        {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!response.ok) {
        console.error('Failed to fetch profile:', response.status);
        return null;
      }

      const data = await response.json();
      set({ profile: data });
      return data;
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      return null;
    }
  },

  initializeAuth: async () => {
    try {
      if (!isSupabaseConfigured()) {
        throw new Error(SUPABASE_NOT_CONFIGURED_ERROR);
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session) {
        set({ session: data.session, user: data.session.user });
        if (typeof window !== 'undefined') {
          localStorage.setItem('authSession', JSON.stringify(data.session));
        }
        get().fetchProfile();
      } else {
        set({ session: null, user: null, profile: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authSession');
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      set({ session: null, user: null, profile: null });
    } finally {
      set({ loading: false });
    }
  },

  signup: async (email, password, fullName) => {
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/signup`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, fullName }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Signup failed');
      }

      const { session, user } = await response.json();
      set({ session, user });
      if (typeof window !== 'undefined' && session) {
        localStorage.setItem('authSession', JSON.stringify(session));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  login: async (email, password) => {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
      }

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const message = error.message || 'Login failed';
        if (message.includes('Email not confirmed') || message.includes('not confirmed')) {
          throw new Error('Please confirm your email address before logging in. Check your inbox for the confirmation link, or contact support if you did not receive it.');
        }
        throw error;
      }

      set({ session: data.session, user: data.user });
      if (typeof window !== 'undefined' && data.session) {
        localStorage.setItem('authSession', JSON.stringify(data.session));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  logout: async () => {
    try {
      if (!isSupabaseConfigured()) {
        return { success: false, error: SUPABASE_NOT_CONFIGURED_ERROR };
      }

      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      set({ session: null, user: null, profile: null });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authSession');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
