import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useDocTitle } from '../hooks/useDocTitle';
import AuthLayout, { IconInput } from '../components/AuthLayout';

export default function Register() {
  useDocTitle('Create Account | TourneyRun');
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]     = useState({ email: '', username: '', password: '', confirmPassword: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [showCPw, setShowCPw] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirmPassword) return setError('Passwords do not match');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      await register(form.email, form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const EyeBtn = ({ show, onToggle }) => (
    <button type="button" onClick={onToggle} className="text-gray-500 hover:text-gray-300 transition-colors text-sm select-none">
      {show ? '🙈' : '👁'}
    </button>
  );

  return (
    <AuthLayout>
      {/* Headline */}
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-white mb-1">Create Your Account</h1>
        <p className="text-gray-400 text-sm">Join the most exciting tournament fantasy game</p>
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
            icon="👤"
            type="text"
            placeholder="Username"
            value={form.username}
            onChange={e => set('username', e.target.value)}
            required
            autoComplete="username"
          />
          <IconInput
            icon="📧"
            type="email"
            placeholder="Email address"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            required
            autoComplete="email"
          />
          <IconInput
            icon="🔒"
            type={showPw ? 'text' : 'password'}
            placeholder="Password (min. 6 characters)"
            value={form.password}
            onChange={e => set('password', e.target.value)}
            required
            autoComplete="new-password"
            rightSlot={<EyeBtn show={showPw} onToggle={() => setShowPw(s => !s)} />}
          />
          <IconInput
            icon="🔒"
            type={showCPw ? 'text' : 'password'}
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={e => set('confirmPassword', e.target.value)}
            required
            autoComplete="new-password"
            rightSlot={<EyeBtn show={showCPw} onToggle={() => setShowCPw(s => !s)} />}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl font-black text-base text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/25 disabled:opacity-50 disabled:scale-100"
          style={{ background: 'linear-gradient(135deg, #378ADD 0%, #2563EB 100%)' }}
        >
          {loading ? 'Creating account…' : 'Create Account →'}
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-gray-800 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-400 hover:text-brand-300 font-semibold transition-colors">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
