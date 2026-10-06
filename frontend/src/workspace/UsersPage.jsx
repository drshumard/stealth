import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Mail, Plus, Trash2, UserCog, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useTimezone } from '@/components/TimezoneContext';
import { authJson } from './auth';
import { Drawer, PageIntro, Person, RecordTable, Status, SurfaceHead, count } from './ui';

// Users (admins only): who can sign in to the workspace.
export default function UsersPage({ me }) {
  const qc = useQueryClient();
  const { formatDateTime } = useTimezone();
  const [editing, setEditing] = useState(null);      // user object, or 'new'
  const q = useQuery({ queryKey: ['users'], queryFn: () => authJson('/users'), enabled: me?.role === 'admin', retry: false });

  if (me?.role !== 'admin') return <>
    <PageIntro eyebrow="Admin / Access" title="Users" description="Only admins can manage who has access." />
    <section className="sp-surface"><div className="sp-empty">Ask an admin if you need someone added or removed.</div></section>
  </>;

  const users = q.data?.users || [];
  const mail = !!q.data?.mail_configured;
  const columns = [
    { label: 'Person', key: 'person', className: 'sp-primary', render: u => <Person name={u.name || u.username} email={u.email} /> },
    { label: 'Username', key: 'username', render: u => u.username },
    { label: 'Role', key: 'role', render: u => <Status tone={u.role === 'admin' ? 'blue' : 'quiet'}>{u.role === 'admin' ? 'Admin' : 'Member'}</Status> },
    { label: 'Status', key: 'active', render: u => <Status tone={u.active ? 'green' : 'amber'}>{u.active ? 'Active' : 'Disabled'}</Status> },
    { label: 'Last sign-in', key: 'last', render: u => (u.last_login_at ? formatDateTime(u.last_login_at) : 'Never') },
  ];

  return <>
    <PageIntro eyebrow="Admin / Access" title="Users" description="Who can sign in to the Stealth workspace, and what they can do."
      actions={<button type="button" className="sp-primary-button" onClick={() => setEditing('new')}><UserPlus size={16} /> Add user</button>} />
    {!mail && q.data && (
      <div className="sp-integration sp-mail-note">
        <span className="sp-integration-icon"><Mail size={19} /></span>
        <div><span className="sp-eyebrow">Email</span><strong>Password-reset emails are off</strong>
          <p>Set <code>SMTP_USER</code> and <code>SMTP_PASSWORD</code> (a Gmail app password) in the server’s <code>.env</code> to turn on “Forgot password” and invite emails. Until then, set passwords here.</p></div>
      </div>
    )}
    <section className="sp-surface">
      <SurfaceHead eyebrow="Access" title="Everyone with an account"><span className="sp-count">{count(users.length)} users</span></SurfaceHead>
      {q.isLoading ? <div className="sp-empty">Loading users…</div> : q.isError ? <div className="sp-empty">{q.error.message}</div> : (
        <RecordTable rows={users} columns={columns} label="Users" onOpen={u => setEditing(u)}
          foot={<><span>Admins can add, edit and remove users. Members use everything else.</span><span>Click a person to edit</span></>} />
      )}
    </section>
    <UserDrawer key={editing?.id || editing || 'none'} user={editing} me={me} mail={mail} onClose={() => setEditing(null)}
      onSaved={() => qc.invalidateQueries({ queryKey: ['users'] })} />
  </>;
}

function UserDrawer({ user, me, mail, onClose, onSaved }) {
  const isNew = user === 'new';
  const u = isNew ? {} : user || {};
  const [name, setName] = useState(u.name || '');
  const [username, setUsername] = useState(u.username || '');
  const [email, setEmail] = useState(u.email || '');
  const [role, setRole] = useState(u.role || 'member');
  const [active, setActive] = useState(u.active ?? true);
  const [mode, setMode] = useState(isNew && mail ? 'invite' : 'set');   // invite | set  (new users)
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useEffect(() => { setError(''); }, [user]);
  const self = !isNew && u.id === me?.id;

  const save = async e => {
    e.preventDefault();
    setError('');
    setBusy('save');
    try {
      if (isNew) {
        const res = await authJson('/users', { method: 'POST', body: { name, username, email, role, password: mode === 'set' ? password : '' } });
        toast.success(mode === 'invite' ? (res.invite_sent ? `Invite emailed to ${email}` : 'User added, but the invite email failed — set a password instead') : 'User added');
      } else {
        await authJson(`/users/${u.id}`, { method: 'PATCH', body: { name, email, role, active, ...(password ? { password } : {}) } });
        toast.success(password ? 'Saved — they’ll need the new password to sign in' : 'Saved');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const sendReset = async () => {
    setBusy('reset');
    try {
      await authJson(`/users/${u.id}/send-reset`, { method: 'POST' });
      toast.success(`Reset link emailed to ${u.email}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };
  const remove = async () => {
    try {
      await authJson(`/users/${u.id}`, { method: 'DELETE' });
      toast.success('User removed');
      onSaved();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Drawer open={!!user} onClose={onClose} eyebrow={isNew ? 'Users / new' : 'Users / edit'} label={isNew ? 'Add user' : 'Edit user'}>
      <form className="sp-drawer-body sp-form-drawer" onSubmit={save}>
        <span className="sp-drawer-avatar">{isNew ? <Plus size={22} /> : <UserCog size={22} />}</span>
        <h2>{isNew ? 'Add a user' : u.name || u.username}</h2>
        <p>{isNew ? 'They sign in with their username (or email) and password.' : `@${u.username}${self ? ' · this is you' : ''}`}</p>
        {error && <div className="sp-login-error" role="alert">{error}</div>}
        <div className="sp-form-stack">
          <label className="sp-form-field"><span>Full name</span><input className="sp-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Vanessa Lee" /></label>
          {isNew && <label className="sp-form-field"><span>Username</span><input className="sp-input" value={username} required autoCapitalize="none" spellCheck={false}
            onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ''))} placeholder="e.g. vanessa" /><small>Letters, numbers, dot, dash or underscore.</small></label>}
          <label className="sp-form-field"><span>Email</span><input className="sp-input" type="email" value={email} required onChange={e => setEmail(e.target.value)} placeholder="name@drshumard.com" /><small>Used for password resets.</small></label>
          <div className="sp-form-field"><span>Role</span>
            <div className="an-segmented" role="radiogroup" aria-label="Role">
              {[['member', 'Member'], ['admin', 'Admin']].map(([v, l]) => <button key={v} type="button" role="radio" aria-checked={role === v} onClick={() => setRole(v)}>{l}</button>)}
            </div>
            <small>{role === 'admin' ? 'Can also add, edit and remove users.' : 'Uses the workspace; can’t manage users.'}</small>
          </div>
          {isNew ? (
            <div className="sp-form-field"><span>Password</span>
              {mail && <div className="an-segmented" role="radiogroup" aria-label="Password">
                <button type="button" role="radio" aria-checked={mode === 'invite'} onClick={() => setMode('invite')}>Email them a link</button>
                <button type="button" role="radio" aria-checked={mode === 'set'} onClick={() => setMode('set')}>Set it now</button>
              </div>}
              {mode === 'set'
                ? <><input className="sp-input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoComplete="off" />
                  <small>Share it with them privately; they can change it under their name → Change password.</small></>
                : <small>We’ll email a link (valid 3 days) so they choose their own password.</small>}
            </div>
          ) : <>
            <label className="sp-form-field"><span>Set a new password <small>(optional)</small></span>
              <input className="sp-input" type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Leave blank to keep the current one" minLength={8} autoComplete="off" />
              {mail && <button type="button" className="sp-add-link" onClick={sendReset} disabled={busy === 'reset'}>
                {busy === 'reset' ? <Loader2 size={13} className="sp-spin" /> : <Mail size={13} />} Or email them a reset link</button>}
            </label>
            {!self && <label className="sp-check-row"><input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} />
              <span><strong>Can sign in</strong> — untick to disable the account without deleting it</span></label>}
          </>}
        </div>
        <div className="sp-builder-foot sp-drawer-foot">
          {!isNew && !self && <button type="button" className="sp-secondary-button sp-danger-button" onClick={() => setConfirmDelete(true)}><Trash2 size={14} /> Remove</button>}
          <span className="an-filter-spacer" />
          <button type="button" className="sp-secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="sp-primary-button" disabled={busy === 'save'}>{busy === 'save' && <Loader2 size={15} className="sp-spin" />}{isNew ? (mode === 'invite' ? 'Add and send invite' : 'Add user') : 'Save'}</button>
        </div>
      </form>
      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent className="sp-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {u.name || u.username}?</AlertDialogTitle>
            <AlertDialogDescription>They’ll be signed out everywhere and won’t be able to sign in again. This can’t be undone — to pause access instead, untick “Can sign in”.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="sp-secondary-button">Cancel</AlertDialogCancel>
            <AlertDialogAction className="sp-danger-solid" onClick={remove}>Remove user</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Drawer>
  );
}
