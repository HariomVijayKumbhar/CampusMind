import { create } from 'zustand';
import { supabase } from '@/services/supabaseClient';

export const useAuthStore = create((set) => ({
  session: typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('authSession') || 'null') : null,
  user: null,
  loading: true,

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
      } else {
        set({ session: null, user: null });
        if (typeof window !== 'undefined') {
          localStorage.removeItem('authSession');
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      set({ session: null, user: null });
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

      set({ session: null, user: null });
      if (typeof window !== 'undefined') {
        localStorage.removeItem('authSession');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },
}));
