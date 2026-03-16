import { useState } from 'react';
import api from '../api';

export default function ConnectRefresh() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRestart = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/payments/connect/onboard');
      window.location.href = res.data.url;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to restart onboarding');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <div className="w-24 h-24 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
        <span className="text-5xl">⚠️</span>
      </div>

      <h1 className="text-2xl font-bold text-white mb-3">
        Onboarding Link Expired
      </h1>

      <p className="text-gray-400 mb-8">
        Your Stripe onboarding link has expired. This can happen if the link was
        not used within a few minutes. Click below to generate a fresh link and
        complete your account setup.
      </p>

      {error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 rounded-lg p-3 text-sm mb-6">
          {error}
        </div>
      )}

      <button
        onClick={handleRestart}
        disabled={loading}
        className="btn-primary px-8 py-3"
      >
        {loading ? 'Generating Link...' : 'Restart Onboarding →'}
      </button>
    </div>
  );
}
