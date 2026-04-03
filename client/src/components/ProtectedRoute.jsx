import { useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import BallLoader from './BallLoader';
import GolfLoader from './golf/GolfLoader';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const isGolf = location.pathname.startsWith('/golf');

  // Navigate to login via useEffect so we never return null.
  // <Navigate> returns null for one paint cycle before its own useEffect fires —
  // that null IS the black screen flash. useEffect navigation fires after commit,
  // so the loader below is visible the whole time instead of going dark.
  useEffect(() => {
    if (loading) return;
    if (!user) {
      const then = encodeURIComponent(location.pathname + location.search);
      navigate(`/login?then=${then}`, { replace: true });
      return;
    }
    // Force-reset guard: superadmin set a temp password — bounce back until changed
    if (user.force_password_reset && location.pathname !== '/account/set-password') {
      navigate('/account/set-password', { replace: true });
    }
  }, [user, loading, location.pathname, location.search, navigate]);

  // Always show a themed loader while auth is unresolved or unauthenticated —
  // never render null, never show a black screen.
  if (loading || !user) {
    return isGolf ? <GolfLoader fullScreen /> : <BallLoader fullScreen />;
  }

  return children;
}
