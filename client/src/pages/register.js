import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/store/authStore';

export default function Register() {
  const router = useRouter();
  const signup = useAuthStore((state) => state.signup);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    const result = await signup(email, password, fullName);

    if (result.success) {
      router.push('/chat');
    } else {
      setError(result.error || 'Registration failed. Please try again.');
    }

    setLoading(false);
  };

  return (
    <>
      <Head>
        <title>Create Account — CampusMind</title>
        <meta name="description" content="Create your CampusMind account to start asking questions about your college." />
      </Head>

      <div
        className="relative flex min-h-screen items-center justify-center px-4 py-12 overflow-hidden"
        style={{ background: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(139,92,246,0.18) 0%, rgb(15,15,23) 60%)' }}
      >
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-violet-600/20 blur-[80px]" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-pink-600/15 blur-[80px]" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 text-center">
            <div
              className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgb(139,92,246), rgb(236,72,153))', boxShadow: '0 8px 32px rgba(139,92,246,0.4)' }}
            >
              <svg className="h-7 w-7 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l9-5-9-5-9 5 9 5z"/>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"/>
              </svg>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">CampusMind</h1>
            <p className="mt-1.5 text-sm text-slate-400">Create your account to get started</p>
          </div>

          <div className="auth-card animate-fade-in">
            <h2 className="mb-6 text-xl font-semibold text-white">Create account</h2>

            {error && (
              <div className="cm-banner-error mb-5">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd"/>
                </svg>
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="cm-label">Full Name</label>
                <input
                  id="fullName"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Hariom Vijay Kumbhar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="cm-input"
                />
              </div>

              <div>
                <label htmlFor="email" className="cm-label">Email</label>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="you@college.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="cm-input"
                />
              </div>

              <div>
                <label htmlFor="password" className="cm-label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="cm-input pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    aria-label="Toggle password visibility"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      {showPassword
                        ? <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"/>
                        : <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41z" clipRule="evenodd"/>
                      }
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="cm-label">Confirm Password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="cm-input"
                />
              </div>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <div className="space-y-1.5">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4].map((level) => {
                      const strength = password.length >= 10 ? 4 : password.length >= 8 ? 3 : password.length >= 6 ? 2 : 1;
                      return (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                            level <= strength
                              ? strength >= 4 ? 'bg-emerald-500' : strength >= 3 ? 'bg-blue-500' : strength >= 2 ? 'bg-amber-500' : 'bg-red-500'
                              : 'bg-white/10'
                          }`}
                        />
                      );
                    })}
                  </div>
                  <p className="text-xs text-slate-500">
                    {password.length < 6 ? 'Too short' : password.length < 8 ? 'Fair' : password.length < 10 ? 'Good' : 'Strong'}
                  </p>
                </div>
              )}

              <button
                id="register-submit"
                type="submit"
                disabled={loading}
                className="cm-btn-primary mt-2"
              >
                {loading ? (
                  <>
                    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Creating account...
                  </>
                ) : 'Create account'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link href="/login" className="font-medium text-violet-400 hover:text-violet-300 transition-colors">
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
