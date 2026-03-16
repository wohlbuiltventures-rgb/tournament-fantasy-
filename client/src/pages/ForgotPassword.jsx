import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDocTitle } from '../hooks/useDocTitle';
import AuthLayout, { IconInput } from '../components/AuthLayout';
import api from '../api';

export default function ForgotPassword() {
  useDocTitle('Reset Password | TourneyRun');
  const [email, setEmail]     = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="text-center mb-7">
        <h1 className="text-2xl font-black text-white mb-1">Reset Password</h1>
        <p className="text-gray-400 text-sm">We'll send you a link to set a new password</p>
      </div>

      {submitted ? (
        <div className="text-center space-y-4">
          <div className="text-5xl mb-2">📬</div>
          <p className="text-gray-300 text-sm leading-relaxed">
            If that email is registered, you'll receive a reset link shortly. Check your inbox (and spam folder).
          </p>
          <p className="text-gray-500 text-xs">The link expires in 1 hour.</p>
          <Link
            to="/login"
            className="block mt-4 text-brand-400 hover:text-brand-300 font-semibold text-sm transition-colors"
          >
            ← Back to Sign In
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg px-3.5 py-2.5 text-sm">
              <span className="shrink-0 mt-0.5">⚠️</span>
              {error}
            </div>
          )}

          <IconInput
            icon="📧"
            type="email"
            placeholder="Your account email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-black text-base text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg hover:shadow-brand-500/25 disabled:opacity-50 disabled:scale-100"
            style={{ background: 'linear-gradient(135deg, #378ADD 0%, #2563EB 100%)' }}
          >
            {loading ? 'Sending…' : 'Send Reset Link →'}
          </button>

          <div className="text-center">
            <Link to="/login" className="text-xs text-gray-600 hover:text-gray-400 transition-colors">
              ← Back to Sign In
            </Link>
          </div>
        </form>
      )}
    </AuthLayout>
  );
}
