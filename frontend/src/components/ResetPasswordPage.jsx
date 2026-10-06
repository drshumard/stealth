import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { authJson } from '@/workspace/auth';
import { AuthLayout, PasswordField } from './LoginPage';

// /reset-password?token=… — from the forgot-password or invite email. Public: works without being signed in.
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [check, setCheck] = useState(null);           // null = checking
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!token) { setCheck({ valid: false }); return; }
    authJson(`/auth/reset/check?token=${encodeURIComponent(token)}`).then(setCheck).catch(() => setCheck({ valid: false }));
  }, [token]);

  const submit = async e => {
    e.preventDefault();
    setError('');
    if (password.length < 8) return setError('Use at least 8 characters.');
    if (password !== confirm) return setError('The two passwords don’t match.');
    setLoading(true);
    try {
      await authJson('/auth/reset', { method: 'POST', body: { token, password } });
      setDone(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  const toLogin = () => navigate('/', { replace: true });

  if (check === null) return <AuthLayout><h2>One moment…</h2><p><Loader2 size={16} className="sp-spin" /> Checking your link</p></AuthLayout>;
  if (done) return (
    <AuthLayout>
      <span className="sp-login-icon" data-tone="green"><CheckCircle2 size={22} /></span>
      <h2>Password saved</h2>
      <p>You can now sign in with your new password.</p>
      <button type="button" className="sp-primary-button sp-login-submit" onClick={toLogin}>Go to sign in</button>
    </AuthLayout>
  );
  if (!check.valid) return (
    <AuthLayout>
      <h2>This link has expired</h2>
      <p>Reset links work once and expire after an hour. Ask for a new one from the sign-in page.</p>
      <button type="button" className="sp-primary-button sp-login-submit" onClick={toLogin}>Back to sign in</button>
    </AuthLayout>
  );
  return (
    <AuthLayout>
      <h2>Choose a password</h2>
      <p>For <strong>{check.name || check.username}</strong> ({check.username}). At least 8 characters.</p>
      {error && <div className="sp-login-error" role="alert">{error}</div>}
      <form onSubmit={submit}>
        <PasswordField value={password} onChange={setPassword} placeholder="New password" autoComplete="new-password" autoFocus />
        <PasswordField value={confirm} onChange={setConfirm} placeholder="Repeat new password" autoComplete="new-password" />
        <button type="submit" className="sp-primary-button sp-login-submit" disabled={loading}>
          {loading ? <><Loader2 size={15} className="sp-spin" /> Saving…</> : 'Save password'}
        </button>
      </form>
    </AuthLayout>
  );
}
