import { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import GolfNavbar from './GolfNavbar';
import GolfProfileOnboarding from './golf/GolfProfileOnboarding';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

// Public paths where we never show the onboarding prompt
const PUBLIC_PATHS = ['/golf', '/golf/faq', '/golf/strategy', '/golf/payment/success'];

export default function GolfLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding]   = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  const isPublicPath = PUBLIC_PATHS.includes(location.pathname) ||
                       location.pathname.startsWith('/golf/admin');

  useEffect(() => {
    if (!user || isPublicPath) {
      setOnboardingChecked(true);
      return;
    }
    api.get('/golf/profile/status')
      .then(r => {
        if (!r.data.profileComplete) setShowOnboarding(true);
        setOnboardingChecked(true);
      })
      .catch(() => setOnboardingChecked(true));
  }, [user?.id, location.pathname]);

  return (
    <>
      <GolfNavbar />
      <Outlet />
      {showOnboarding && onboardingChecked && (
        <GolfProfileOnboarding
          onComplete={() => setShowOnboarding(false)}
          onSkip={() => setShowOnboarding(false)}
        />
      )}
    </>
  );
}
