import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const BG_IMAGE    = 'https://portal-drshumard.b-cdn.net/Gemini_Generated_Image_2muj7a2muj7a2muj.jpeg';

export default function LoginPage({ onLogin }) {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Login failed');
      onLogin(data.token);
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-end"
      style={{
        backgroundImage:    `url(${BG_IMAGE})`,
        backgroundSize:     'cover',
        backgroundPosition: 'center',
        backgroundRepeat:   'no-repeat',
      }}
    >
      {/* Login card — sits in the right portion, vertically centred */}
      <div
        className="mr-[8%] w-[400px]"
        style={{
          background:   'rgba(255,252,248,0.92)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          borderRadius: '24px',
          border:       '1px solid rgba(255,255,255,0.6)',
          boxShadow:    '0 24px 60px rgba(3,3,82,0.18), 0 4px 16px rgba(0,0,0,0.08)',
          padding:      '48px 40px',
        }}
      >
        {/* Brand */}
        <div className="mb-8">
          <h1
            className="text-3xl font-bold mb-1"
            style={{ fontFamily: 'Space Grotesk, sans-serif', color: '#030352', letterSpacing: '-0.03em' }}
          >
            Welcome to Tether.
          </h1>
          <p className="text-sm" style={{ color: '#9898aa' }}>
            Sign in to your dashboard
          </p>
        </div>

        {/* Error */}
        {error && (
          <div
            className="mb-5 px-4 py-3 rounded-xl text-sm font-medium"
            style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b' }}
          >
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email */}
          <div className="relative">
            <Mail
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#9898aa' }}
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email address"
              autoComplete="email"
              required
              className="w-full pl-11 pr-4 py-3.5 text-sm rounded-xl outline-none transition-all duration-150"
              style={{
                backgroundColor: '#f7f4f0',
                border:          '1.5px solid #e8e3dc',
                color:           '#0f0f1a',
                fontFamily:      'Work Sans, sans-serif',
              }}
              onFocus={e  => { e.target.style.border = '1.5px solid #A31800'; e.target.style.backgroundColor = '#fff'; }}
              onBlur={e   => { e.target.style.border = '1.5px solid #e8e3dc'; e.target.style.backgroundColor = '#f7f4f0'; }}
            />
          </div>

          {/* Password */}
          <div className="relative">
            <Lock
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ color: '#9898aa' }}
            />
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoComplete="current-password"
              required
              className="w-full pl-11 pr-11 py-3.5 text-sm rounded-xl outline-none transition-all duration-150"
              style={{
                backgroundColor: '#f7f4f0',
                border:          '1.5px solid #e8e3dc',
                color:           '#0f0f1a',
                fontFamily:      'Work Sans, sans-serif',
              }}
              onFocus={e  => { e.target.style.border = '1.5px solid #A31800'; e.target.style.backgroundColor = '#fff'; }}
              onBlur={e   => { e.target.style.border = '1.5px solid #e8e3dc'; e.target.style.backgroundColor = '#f7f4f0'; }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors duration-150"
              style={{ color: '#9898aa' }}
            >
              {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 text-sm font-bold text-white rounded-xl transition-all duration-150 mt-2 flex items-center justify-center gap-2"
            style={{
              backgroundColor: loading ? '#b52000' : '#A31800',
              fontFamily:      'Space Grotesk, sans-serif',
              letterSpacing:   '0.01em',
              opacity:         loading ? 0.85 : 1,
              boxShadow:       '0 4px 14px rgba(163,24,0,0.35)',
            }}
          >
            {loading ? <><Loader2 size={15} className="animate-spin" /> Signing in…</> : 'Log In'}
          </button>
        </form>

        {/* Forgot */}
        <div className="mt-5 text-center">
          <button
            type="button"
            className="text-xs transition-colors duration-150"
            style={{ color: '#9898aa' }}
          >
            Forgot Password?
          </button>
        </div>
      </div>
    </div>
  );
}
