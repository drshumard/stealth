import { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, MailCheck, User } from 'lucide-react';
import { authJson } from '@/workspace/auth';

// Sign-in — the workspace look: the prototype's blue brand panel beside the form. Also hosts "Forgot password".
export function AuthLayout({ children }) {
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
          {children}
        </div>
      </main>
    </div>
  );
}

export function PasswordField({ value, onChange, placeholder = 'Password', autoComplete = 'current-password', autoFocus }) {
  const [show, setShow] = useState(false);
  return (
    <label className="sp-login-field"><span className="sr-only">{placeholder}</span>
      <Lock size={16} aria-hidden="true" />
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        autoComplete={autoComplete} autoFocus={autoFocus} required />
      <button type="button" onClick={() => setShow(v => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </label>
  );
}

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState('login');          // login | forgot | sent
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    if (!identifier.trim() || (mode === 'login' && !password)) return;
    setLoading(true);
    setError('');
    try {
      if (mode === 'login') {
        const data = await authJson('/auth/login', { method: 'POST', body: { identifier: identifier.trim(), password } });
        onLogin(data.token);
      } else {
        await authJson('/auth/forgot', { method: 'POST', body: { identifier: identifier.trim() } });
        setMode('sent');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };
  const go = m => { setMode(m); setError(''); setPassword(''); };

  if (mode === 'sent') return (
    <AuthLayout>
      <span className="sp-login-icon"><MailCheck size={22} /></span>
      <h2>Check your email</h2>
      <p>If <strong>{identifier.trim()}</strong> matches an account, we’ve sent a link to reset its password. It works once and expires in 1 hour.</p>
      <p className="sp-login-small">Nothing arrived? Check spam, or ask an admin to reset it for you.</p>
      <button type="button" className="sp-secondary-button sp-login-submit" onClick={() => go('login')}><ArrowLeft size={15} /> Back to sign in</button>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <h2>{mode === 'login' ? 'Welcome back.' : 'Forgot your password?'}</h2>
      <p>{mode === 'login' ? 'Sign in to your dashboard' : 'Enter your username or email and we’ll email you a link to choose a new one.'}</p>
      {error && <div className="sp-login-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <label className="sp-login-field"><span className="sr-only">Username or email</span>
          <User size={16} aria-hidden="true" />
          <input value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Username or email"
            autoComplete="username" autoCapitalize="none" spellCheck={false} required autoFocus />
        </label>
        {mode === 'login' && <PasswordField value={password} onChange={setPassword} />}
        <button type="submit" className="sp-primary-button sp-login-submit" disabled={loading}>
          {loading ? <><Loader2 size={15} className="sp-spin" /> {mode === 'login' ? 'Signing in…' : 'Sending…'}</> : mode === 'login' ? 'Log In' : 'Email me a reset link'}
        </button>
      </form>
      {mode === 'login'
        ? <button type="button" className="sp-login-forgot" onClick={() => go('forgot')}>Forgot Password?</button>
        : <button type="button" className="sp-login-forgot" onClick={() => go('login')}><ArrowLeft size={12} /> Back to sign in</button>}
    </AuthLayout>
  );
}
