import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';

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

  // Sign-in — the workspace look: the prototype's blue brand panel beside the form.
  return (
    <div className="sp-app sp-login">
      <aside className="sp-login-brand">
        <img src="/dr-shumard-logo.png" width="181" height="27" alt="Dr. Shumard" />
        <div>
          <h1>Every signal, <em>in one place.</em></h1>
          <p>Follow the path from first visit to webinar registration, lead, and sale without losing the human story behind each number.</p>
        </div>
        <span>Dr. Shumard · Stealth workspace</span>
      </aside>
      <main className="sp-login-main">
        <div className="sp-login-card">
          <img className="sp-login-logo" src="/dr-shumard-logo.png" width="181" height="27" alt="Dr. Shumard" />
          <span className="sp-eyebrow">Stealth workspace</span>
          <h2>Welcome back.</h2>
          <p>Sign in to your dashboard</p>

          {error && <div className="sp-login-error" role="alert">{error}</div>}

          <form onSubmit={handleSubmit}>
            <label className="sp-login-field"><span className="sr-only">Email address</span>
              <Mail size={16} aria-hidden="true" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" autoComplete="email" required />
            </label>
            <label className="sp-login-field"><span className="sr-only">Password</span>
              <Lock size={16} aria-hidden="true" />
              <input type={showPass ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Password" autoComplete="current-password" required />
              <button type="button" onClick={() => setShowPass(v => !v)} aria-label={showPass ? 'Hide password' : 'Show password'}>
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </label>
            <button type="submit" className="sp-primary-button sp-login-submit" disabled={loading}>
              {loading ? <><Loader2 size={15} className="sp-spin" /> Signing in…</> : 'Log In'}
            </button>
          </form>

          <button type="button" className="sp-login-forgot">Forgot Password?</button>
        </div>
      </main>
    </div>
  );
}
