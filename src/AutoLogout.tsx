import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function AutoLogout() {
  const navigate = useNavigate();

  useEffect(() => {
    const enabled = () => {
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        return s.autoLoginPage !== false;
      } catch {
        return true;
      }
    };
    const logoutAndRedirect = () => {
      if (!enabled()) return;
      if (!localStorage.getItem('batprox-token')) return;
      localStorage.removeItem('batprox-token');
      localStorage.removeItem('batprox-user');
      navigate('/');
    };
    const onVisibility = () => {
      if (document.hidden && location.protocol !== 'blob:') logoutAndRedirect();
    };
    const onFreeze = () => {
      if (location.protocol !== 'blob:') logoutAndRedirect();
    };
    const onBlur = () => {
      if (location.protocol === 'blob:') return;
      setTimeout(() => {
        if (!document.hasFocus()) logoutAndRedirect();
      }, 200);
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', logoutAndRedirect);
    window.addEventListener('blur', onBlur);
    document.addEventListener('freeze', onFreeze);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', logoutAndRedirect);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('freeze', onFreeze);
    };
  }, [navigate]);

  return null;
}
