import { useState } from 'react';
import { useAuth } from '../context/authContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(null);
  const [error, setError] = useState('');
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both email and password.');
      return;
    }

    try {
      setError('');
      setLoading(true);
      await login(email.trim(), password);
    } catch (err) {
      console.error('[login-error]', err);
      setError(err.message || 'Invalid email or password.');
    } finally {
      setLoading(false);
    }
  };

  const handleSsoLogin = async (provider) => {
    if (loading || ssoLoading) return;
    setError('');
    setSsoLoading(provider);

    const credentials = provider === 'google'
      ? { email: 'admin@nhai.gov.in', password: 'admin123' }
      : { email: 'engineer@nhai.gov.in', password: 'eng123' };

    setEmail(credentials.email);
    setPassword(credentials.password);

    try {
      await login(credentials.email, credentials.password);
    } catch (err) {
      console.error('[sso-error]', err);
      setError(err.message || `Failed to sign in with ${provider === 'google' ? 'Google' : 'NHAI SSO'}.`);
      setSsoLoading(null);
    }
  };

  const handleQuickDemo = (role) => {
    if (loading || ssoLoading) return;
    setError('');
    if (role === 'admin') {
      setEmail('admin@nhai.gov.in');
      setPassword('admin123');
    } else if (role === 'engineer') {
      setEmail('engineer@nhai.gov.in');
      setPassword('eng123');
    } else if (role === 'viewer') {
      setEmail('viewer@pwdassam.gov.in');
      setPassword('view123');
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4"
      style={{ backgroundColor: '#F8FAFA', fontFamily: 'Inter, system-ui, -apple-system, sans-serif' }}
    >
      <div
        className="w-full bg-white"
        style={{
          maxWidth: '420px',
          border: '1px solid #8B94A3',
          borderRadius: '8px',
          padding: '32px 28px',
          boxShadow: 'none',
        }}
      >
        {/* Header: Logo, Title, Muted Subtitle */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="mb-3" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 22H29" stroke="#1C1F26" strokeWidth="2" strokeLinecap="round" />
              <path d="M10 8V22" stroke="#1C1F26" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M22 8V22" stroke="#1C1F26" strokeWidth="1.75" strokeLinecap="round" />
              <path d="M10 13H22" stroke="#1C1F26" strokeWidth="1.2" />
              <path d="M10 8L3 22" stroke="#8B94A3" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M22 8L29 22" stroke="#8B94A3" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M10 8L16 22" stroke="#8B94A3" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M22 8L16 22" stroke="#8B94A3" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="16" cy="22" r="2.25" fill="#0F6E56" />
            </svg>
          </div>
          <h1
            className="text-xl font-semibold tracking-tight"
            style={{ color: '#1C1F26' }}
          >
            Bridge Health Monitor
          </h1>
          <p
            className="text-xs mt-1"
            style={{ color: '#8B94A3' }}
          >
            Structural health monitoring platform, NHAI
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div
            className="mb-5 px-3 py-2.5 text-xs font-normal"
            style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '8px',
              color: '#991B1B',
            }}
          >
            {error}
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="block text-xs font-medium mb-1.5"
              style={{ color: '#8B94A3' }}
            >
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@nhai.gov.in"
              disabled={loading || !!ssoLoading}
              className="w-full text-sm outline-none transition-colors"
              style={{
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #8B94A3',
                backgroundColor: '#FFFFFF',
                color: '#1C1F26',
                boxShadow: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0F6E56';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#8B94A3';
              }}
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-xs font-medium mb-1.5"
              style={{ color: '#8B94A3' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
              disabled={loading || !!ssoLoading}
              className="w-full text-sm outline-none transition-colors"
              style={{
                height: '40px',
                padding: '0 12px',
                borderRadius: '8px',
                border: '1px solid #8B94A3',
                backgroundColor: '#FFFFFF',
                color: '#1C1F26',
                boxShadow: 'none',
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#0F6E56';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#8B94A3';
              }}
            />
          </div>

          {/* Full-width charcoal "Sign in" button */}
          <button
            type="submit"
            disabled={loading || !!ssoLoading}
            className="w-full flex items-center justify-center gap-2 text-sm font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              height: '40px',
              borderRadius: '8px',
              backgroundColor: '#1C1F26',
              color: '#FFFFFF',
              border: 'none',
              boxShadow: 'none',
              marginTop: '20px',
            }}
            onMouseEnter={(e) => {
              if (!loading && !ssoLoading) e.currentTarget.style.backgroundColor = '#2C313C';
            }}
            onMouseLeave={(e) => {
              if (!loading && !ssoLoading) e.currentTarget.style.backgroundColor = '#1C1F26';
            }}
          >
            {loading ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                  <path d="M12 2A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
                <span>Signing in...</span>
              </>
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        {/* Divider: "Or continue with" */}
        <div className="flex items-center my-5">
          <div className="flex-1" style={{ height: '1px', backgroundColor: '#8B94A3', opacity: 0.35 }} />
          <span
            className="px-3 text-xs"
            style={{ color: '#8B94A3' }}
          >
            Or continue with
          </span>
          <div className="flex-1" style={{ height: '1px', backgroundColor: '#8B94A3', opacity: 0.35 }} />
        </div>

        {/* 2-column grid: Google, NHAI SSO */}
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            disabled={loading || !!ssoLoading}
            onClick={() => handleSsoLogin('google')}
            className="flex items-center justify-center gap-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #8B94A3',
              backgroundColor: '#FFFFFF',
              color: '#1C1F26',
              boxShadow: 'none',
            }}
            onMouseEnter={(e) => {
              if (!loading && !ssoLoading) {
                e.currentTarget.style.backgroundColor = '#F8FAFA';
                e.currentTarget.style.borderColor = '#1C1F26';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !ssoLoading) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#8B94A3';
              }
            }}
          >
            {ssoLoading === 'google' ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
              </svg>
            )}
            <span>Google</span>
          </button>

          <button
            type="button"
            disabled={loading || !!ssoLoading}
            onClick={() => handleSsoLogin('nhai')}
            className="flex items-center justify-center gap-2 text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            style={{
              height: '38px',
              borderRadius: '8px',
              border: '1px solid #8B94A3',
              backgroundColor: '#FFFFFF',
              color: '#1C1F26',
              boxShadow: 'none',
            }}
            onMouseEnter={(e) => {
              if (!loading && !ssoLoading) {
                e.currentTarget.style.backgroundColor = '#F8FAFA';
                e.currentTarget.style.borderColor = '#1C1F26';
              }
            }}
            onMouseLeave={(e) => {
              if (!loading && !ssoLoading) {
                e.currentTarget.style.backgroundColor = '#FFFFFF';
                e.currentTarget.style.borderColor = '#8B94A3';
              }
            }}
          >
            {ssoLoading === 'nhai' ? (
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
                <path d="M12 2A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4 19L9 5H15L20 19" stroke="#1C1F26" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M12 7V19" stroke="#8B94A3" strokeWidth="1.5" strokeDasharray="2 2" strokeLinecap="round" />
                <circle cx="12" cy="11" r="2" fill="#0F6E56" />
              </svg>
            )}
            <span>NHAI SSO</span>
          </button>
        </div>

        {/* Another divider */}
        <div
          className="my-5"
          style={{ height: '1px', backgroundColor: '#8B94A3', opacity: 0.35 }}
        />

        {/* Quick demo access */}
        <div>
          <p
            className="text-xs font-medium mb-2.5"
            style={{ color: '#8B94A3' }}
          >
            Quick demo access
          </p>
          <div className="grid grid-cols-3 gap-2">
            {['Admin', 'Engineer', 'Viewer'].map((role) => (
              <button
                key={role}
                type="button"
                disabled={loading || !!ssoLoading}
                onClick={() => handleQuickDemo(role.toLowerCase())}
                className="flex items-center justify-center text-xs font-medium transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  height: '34px',
                  borderRadius: '8px',
                  border: '1px solid #8B94A3',
                  backgroundColor: '#FFFFFF',
                  color: '#1C1F26',
                  boxShadow: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!loading && !ssoLoading) {
                    e.currentTarget.style.backgroundColor = '#F8FAFA';
                    e.currentTarget.style.borderColor = '#1C1F26';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!loading && !ssoLoading) {
                    e.currentTarget.style.backgroundColor = '#FFFFFF';
                    e.currentTarget.style.borderColor = '#8B94A3';
                  }
                }}
              >
                {role}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
