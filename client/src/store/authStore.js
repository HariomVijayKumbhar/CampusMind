import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';

export const useAuthStore = create((set, get) => ({
  session: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('authSession') || 'null') : null,
  user: null,
  // User profile from the backend. Fetched ONCE and shared across all pages
  // so we don't spam /api/auth/profile (which would trip the rate limiter).
  profile: null,
  loading: true,

  // Fetch the user profile from the backend. Cached: once loaded it won't
  // hit the API again unless `force` is true. Pass `force` to refresh.
  fetchProfile: async (force = false) => {
    const { profile, session } = get();
    if (profile && !force) return profile;
    if (!session?.access_token) return null;

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'}/api/auth/profile`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
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

  // Initialize session from localStorage and Supabase
  initializeAuth: async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session) {
        set({ session: data.session, user: data.session.user });
        if (typeof window !== 'undefined') {
          localStorage.setItem('authSession', JSON.stringify(data.session));
        }
        // Load the profile once, in the background, as the single source of truth.
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

  // Sign up with email and password
  signup: async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (error) throw error;

      set({ session: data.session, user: data.user });
      if (typeof window !== 'undefined' && data.session) {
        localStorage.setItem('authSession', JSON.stringify(data.session));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Login with email and password
  login: async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      set({ session: data.session, user: data.user });
      if (typeof window !== 'undefined' && data.session) {
        localStorage.setItem('authSession', JSON.stringify(data.session));
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  // Logout
  logout: async () => {
    try {
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
