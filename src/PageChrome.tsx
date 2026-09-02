import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { applyBackground } from './background';
import { applyTabCloak } from './tabcloak';
import { switchDashboardToAboutBlank } from './cloak';
import { getSavedTheme } from './theme';
import Blossom from './Blossom';

const NO_BLOSSOM_ROUTES = ['/search-engine', '/homework', '/ai-work'];

export default function PageChrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const [showBlossom, setShowBlossom] = useState(
    () => getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(window.location.pathname)
  );

  useEffect(() => {
    applyBackground();
    applyTabCloak();

    setShowBlossom(getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(location.pathname));

    if (location.pathname === '/dashboard') {
      switchDashboardToAboutBlank();
    }
  }, [location.pathname]);

  useEffect(() => {
    const onTheme = () => {
      setShowBlossom(getSavedTheme() === 'Cherry Blossom' && !NO_BLOSSOM_ROUTES.includes(window.location.pathname));
    };
    window.addEventListener('bp-theme', onTheme);
    return () => window.removeEventListener('bp-theme', onTheme);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (e.shiftKey && e.key.toLowerCase() === 'k' && target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        navigate('/search-engine');
        return;
      }
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        if (!s.panicKey) return;
        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
        const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
        if (combo.toLowerCase() !== String(s.panicKey).toLowerCase() && e.key.toLowerCase() !== String(s.panicKey).toLowerCase()) return;
        e.preventDefault();
        const dest = s.panicUrl || 'https://www.google.com/';
        if (window.parent && window.parent !== window) {
          window.parent.postMessage({ type: 'bp-parent', redirect: dest }, '*');
        }
        if (window.top) {
          window.top.location.href = dest;
        } else {
          window.location.href = dest;
        }
      } catch {
      }
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      try {
        const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
        if (!s.closeProtection) return;
        e.preventDefault();
        e.returnValue = '';
      } catch {
      }
    };

    window.addEventListener('keydown', onKey, true);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [navigate]);

  if (!showBlossom) return null;
  return <Blossom />;
}
