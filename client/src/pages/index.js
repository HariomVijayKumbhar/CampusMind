import { useRouter } from 'next/router';
import { useAuthStore } from '@/store/authStore';
import { useEffect } from 'react';

export default function Home() {
  const router = useRouter();
  const { session, loading } = useAuthStore();

  useEffect(() => {
    if (!loading) {
      if (session) {
        router.push('/chat');
      } else {
        router.push('/login');
      }
    }
  }, [loading, session, router]);

  return <div>Redirecting...</div>;
}
