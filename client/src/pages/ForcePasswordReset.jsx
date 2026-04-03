import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthLayout, { IconInput } from '../components/AuthLayout';
import { useDocTitle } from '../hooks/useDocTitle';
import api from '../api';

export default function ForcePasswordReset() {
  useDocTitle('Set New Password | TourneyRun');
  const { user, updateUser, loading } = useAuth();
  const navigate = useNavigate();

  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showNew, setShowNew]     = useState(false);
  const [showConf, setShowConf]   = useState(false);
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  // Redirect if not logged in, or if already past the forced reset
  useEffect(() => {
    if (loading) return;
    if (!user) { navigate('/login', { replace: true }); return; }
    if (!user.force_password_reset) { navigate('/', { replace: true }); }
  }, [user, loading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (newPw.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { setError('Passwords do not match'); return; }
    setSaving(true);
    try {
      await api.post('/auth/force-reset-password', { newPassword: newPw });
      updateUser({ force_password_reset: false });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update password. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  if (loading || !user) return null;

  return (
    <AuthLayout>
      <div className="text-center mb-7">
        <div style={{
          width: 48, height: 48, borderRadius: 12,
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 16px',
        }}>
          <span style={{ fontSize: 22 }}>🔐</span>
        </div>
        <h1 className="text-2xl font-black text-white mb-2">Set Your Password</h1>
        <p className="text-gray-400 text-sm leading-relaxed">
          Your account was given a temporary password.<br />
          Create a new one to continue.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-2.5 text-sm">
            <span className="shrink-0 mt-0.5">⚠️</span>
            {error}
          </div>
        )}

        <div className="space-y-3">
          <IconInput
            icon="🔒"
            type={showNew ? 'text' : 'password'}
            placeholder="New password (min 6 characters)"
            value={newPw}
            onChange={e => setNewPw(e.target.value)}
            required
            autoComplete="new-password"
            rightSlot={
              <button type="button" onClick={() => setShowNew(s => !s)} className="p-2 text-gray-500 hover:text-gray-300 transition-colors text-sm select-none">
                {showNew ? '🙈' : '👁'}
              </button>
            }
          />
          <IconInput
            icon="✅"
            type={showConf ? 'text' : 'password'}
            placeholder="Confirm new password"
            value={confirmPw}
            onChange={e => setConfirmPw(e.target.value)}
            required
            autoComplete="new-password"
            rightSlot={
              <button type="button" onClick={() => setShowConf(s => !s)} className="p-2 text-gray-500 hover:text-gray-300 transition-colors text-sm select-none">
                {showConf ? '🙈' : '👁'}
              </button>
            }
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full py-3 rounded-xl font-black text-base text-black transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:scale-100"
          style={{ background: 'linear-gradient(135deg, #22c55e 0%, #00c96a 100%)' }}
        >
          {saving ? 'Saving…' : 'Set New Password →'}
        </button>
      </form>

      <p className="mt-5 text-center text-xs text-gray-600">
        Signed in as <span className="text-gray-400">{user.email}</span>
      </p>
    </AuthLayout>
  );
}
