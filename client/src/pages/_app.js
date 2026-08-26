import '../styles/globals.css';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Initialize auth on app load
    useAuthStore.getState().initializeAuth();
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;
