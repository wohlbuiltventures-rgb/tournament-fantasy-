import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/**
 * /ref/:code — stores the referral code in localStorage then redirects to /register.
 * The Register page reads it and forwards it to the API on account creation.
 */
export default function RefRedirect() {
  const { code } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (code) localStorage.setItem('ref_code', code.toUpperCase());
    navigate('/register', { replace: true });
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}
