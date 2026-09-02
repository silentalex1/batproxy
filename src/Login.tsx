import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import BatMascot from './BatMascot';
import { launchBlobCloak } from './cloak';
import { applyTabCloak } from './tabcloak';

interface FieldErrors {
  username?: string;
  inviteCode?: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number } | null>(null);
  const [showForgot, setShowForgot] = useState(false);
  const [invitedBy, setInvitedBy] = useState('');
  const [denyNotice, setDenyNotice] = useState(false);
  const [denyFading, setDenyFading] = useState(false);

  const SECRET_KEY = 'QGBoaWJB';

  const decodeKey = () =>
    Array.from(atob(SECRET_KEY))
      .map(c => c.charCodeAt(0))
      .map((b, i) => String.fromCharCode(b ^ (i + 7)))
      .reverse()
      .join('');

  const openForgot = () => {
    setCtxMenu(null);
    setInvitedBy('');
    setShowForgot(true);
  };

  const showDeny = () => {
    setDenyNotice(true);
    setDenyFading(false);
    setTimeout(() => setDenyFading(true), 3000);
    setTimeout(() => {
      setDenyNotice(false);
      setDenyFading(false);
    }, 3700);
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (invitedBy.trim().toLowerCase() !== decodeKey().toLowerCase()) {
      setShowForgot(false);
      return;
    }
    const token = localStorage.getItem('batprox-token');
    if (!token) {
      setShowForgot(false);
      showDeny();
      return;
    }
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setShowForgot(false);
        navigate('/dashboard');
      } else {
        localStorage.removeItem('batprox-token');
        localStorage.removeItem('batprox-user');
        setShowForgot(false);
        showDeny();
      }
    } catch {
      setShowForgot(false);
      showDeny();
    }
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const particles: Array<{ x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; hue: number }> = [];
    const last = { x: 0, y: 0 };
    let hasLast = false;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const onMove = (e: MouseEvent) => {
      if (!hasLast) {
        last.x = e.clientX;
        last.y = e.clientY;
        hasLast = true;
        return;
      }
      const dx = e.clientX - last.x;
      const dy = e.clientY - last.y;
      const dist = Math.hypot(dx, dy);
      const steps = Math.min(Math.floor(dist / 10) + 1, 4);
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        particles.push({
          x: last.x + dx * t + (Math.random() - 0.5) * 6,
          y: last.y + dy * t + (Math.random() - 0.5) * 6,
          vx: (Math.random() - 0.5) * 0.7,
          vy: (Math.random() - 0.5) * 0.7 - 0.35,
          life: 0,
          maxLife: 45 + Math.random() * 35,
          size: 1.2 + Math.random() * 2.4,
          hue: 262 + Math.random() * 28
        });
      }
      last.x = e.clientX;
      last.y = e.clientY;
    };
    window.addEventListener('mousemove', onMove);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.985;
        p.vy = p.vy * 0.985 + 0.015;
        const fade = 1 - p.life / p.maxLife;
        if (fade <= 0) {
          particles.splice(i, 1);
          continue;
        }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * fade, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue}, 92%, 72%, ${fade * 0.85})`;
        ctx.shadowColor = `hsla(${p.hue}, 92%, 65%, ${fade})`;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  useEffect(() => {
    applyTabCloak();
    launchBlobCloak();
  }, []);

  const validateUsername = (value: string): string | undefined => {
    if (!value.trim()) return 'Username is required.';
    if (value.trim().length < 3) return 'Username must be at least 3 characters.';
    if (value.trim().length > 20) return 'Username must be 20 characters or fewer.';
    return undefined;
  };

  const validateInviteCode = (value: string): string | undefined => {
    if (!value.trim()) return 'Invite code is required.';
    if (value.trim().length < 6) return 'Invite code must be at least 6 characters.';
    return undefined;
  };

  const handleBlur = (field: 'username' | 'inviteCode') => {
    const value = field === 'username' ? username : inviteCode;
    const error = field === 'username' ? validateUsername(value) : validateInviteCode(value);
    setErrors(prev => ({ ...prev, [field]: error }));
  };

  const handleChange = (field: 'username' | 'inviteCode', value: string) => {
    if (field === 'username') setUsername(value);
    else setInviteCode(value);
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
    if (serverError) setServerError('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');
    const usernameError = validateUsername(username);
    const codeError = validateInviteCode(inviteCode);
    setErrors({ username: usernameError, inviteCode: codeError });
    if (usernameError || codeError) return;

    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), inviteCode: inviteCode.trim() })
      });
      const data = await response.json();
      if (!response.ok) {
        setServerError(data.error || 'Login failed');
        setLoading(false);
        return;
      }
      localStorage.setItem('batprox-token', data.token);
      localStorage.setItem('batprox-user', data.user.username);
      navigate('/dashboard');
    } catch {
      setServerError('Network error. Please make sure the backend server is running.');
      setLoading(false);
    }
  };

  const inputClasses = (hasError?: string) =>
    `w-full px-4 sm:px-5 py-3.5 sm:py-4 rounded-2xl bg-white/[0.06] border text-white text-sm sm:text-base focus:outline-none transition-all backdrop-blur-md text-left shadow-xl ${
      hasError
        ? 'border-red-500/60 focus:border-red-500 focus:ring-2 focus:ring-red-500/30'
        : 'border-white/15 hover:border-white/25 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/70'
    }`;

  return (
    <div
      className="relative min-h-screen w-full bg-black overflow-y-auto font-sans text-white flex items-center justify-center px-4"
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenu({ x: e.clientX, y: e.clientY });
      }}
      onClick={() => setCtxMenu(null)}
    >
      <div className="fixed inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-repeat opacity-60"
          style={{
            backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
                              radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
                              radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)),
                              radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`,
            backgroundSize: '350px 350px',
          }}
        />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[28rem] h-[28rem] bg-purple-600/30 rounded-full blur-[140px]" />
        <div className="absolute top-2/3 left-1/3 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-indigo-500/20 rounded-full blur-[110px]" />
        <div className="absolute bottom-10 right-1/4 w-64 h-64 bg-fuchsia-600/10 rounded-full blur-[100px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.55)_70%,#000_100%)]" />
      </div>

      <canvas ref={canvasRef} className="fixed inset-0 pointer-events-none z-[5]" />

      <main className="relative z-10 w-full max-w-md">
        <div className="flex flex-col items-center text-center mb-8 sm:mb-14">
          <div className="relative">
            <div className="absolute -inset-5 bg-purple-600/25 rounded-full blur-2xl animate-pulse-slow pointer-events-none" />
            <button
              type="button"
              onDoubleClick={openForgot}
              title="Double-click the bat"
              className="relative w-24 h-24 rounded-[28px] bg-gradient-to-br from-purple-600 via-purple-500 to-indigo-600 flex items-center justify-center shadow-2xl shadow-purple-600/40 mb-6 ring-1 ring-white/20 transition-transform duration-300 hover:scale-105 active:scale-95 animate-bat-float"
            >
              <BatMascot size={86} />
            </button>
            {showForgot && (
              <form
                onSubmit={handleForgotSubmit}
                className="absolute left-full top-0 ml-5 w-64 bg-[#0d0d12] border border-white/10 rounded-2xl p-4 shadow-2xl z-20 animate-fade-in"
              >
                <label className="block text-xs text-white/50 mb-2 text-left">Who invited you?</label>
                <input
                  type="text"
                  value={invitedBy}
                  onChange={(e) => setInvitedBy(e.target.value)}
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-3"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
                >
                  Submit
                </button>
              </form>
            )}
          </div>
          <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight mb-3" style={{ color: 'var(--bp-accent)', textShadow: '0 0 25px rgba(var(--bp-glow), 0.35)' }}>
            Bat Prox
          </h1>
          <p className="text-gray-400 text-sm tracking-wide">Login to your account.</p>
        </div>

        <form
          onSubmit={handleLogin}
          noValidate
          className="relative bg-black/55 border border-white/[0.12] rounded-3xl p-6 sm:p-9 backdrop-blur-2xl shadow-[0_30px_80px_-20px_rgba(88,28,135,0.55)] space-y-5 sm:space-y-7 overflow-hidden"
        >
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />
          <div>
            <label
              htmlFor="login-username"
              className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2 cursor-pointer"
            >
              Username
            </label>
            <div className="relative">
              <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
              </svg>
              <input
                id="login-username"
                type="text"
                autoComplete="off"
                value={username}
                onChange={(e) => handleChange('username', e.target.value)}
                onBlur={() => handleBlur('username')}
                placeholder="enter the username"
                className={`${inputClasses(errors.username)} placeholder-gray-400 pl-12`}
              />
            </div>
            {errors.username && (
              <p className="text-red-400 text-xs mt-2 ml-1">{errors.username}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="login-invite"
              className="block text-xs font-medium text-gray-300 uppercase tracking-wider mb-2 cursor-pointer"
            >
              Invite Code
            </label>
            <div className="relative">
              <svg className="w-5 h-5 text-gray-500 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
              <input
                id="login-invite"
                type="password"
                autoComplete="off"
                value={inviteCode}
                onChange={(e) => handleChange('inviteCode', e.target.value)}
                onBlur={() => handleBlur('inviteCode')}
                placeholder="invite code: XXXX-XXXX"
                className={`${inputClasses(errors.inviteCode)} placeholder-gray-400 pl-12`}
              />
            </div>
            {errors.inviteCode && (
              <p className="text-red-400 text-xs mt-2 ml-1">{errors.inviteCode}</p>
            )}
          </div>

          {serverError && (
            <div className="px-4 py-3 rounded-xl bg-red-600/20 border border-red-500/30 text-red-300 text-sm text-center">
              {serverError}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[48px] py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 hover:shadow-2xl hover:shadow-purple-600/40 text-white font-semibold transition-all hover:scale-[1.02] shadow-xl disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-xl flex items-center justify-center gap-3"
          >
            {loading && (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
              </svg>
            )}
            <span>{loading ? 'Logging in...' : 'Login'}</span>
          </button>
        </form>

        <p className="text-center text-gray-500 text-xs mt-6">
          An invite code is required to access Bat Prox.
        </p>
        <div className="text-center mt-5">
          <p className="text-[11px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-full px-4 py-1.5 inline-block">
            beta release (expect some bugs) - if bugs make a report.
          </p>
        </div>
      </main>

      {ctxMenu && (
        <div
          className="fixed z-50 bg-[#0d0d12] border border-white/15 rounded-xl shadow-2xl overflow-hidden"
          style={{ left: ctxMenu.x, top: ctxMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={openForgot}
            className="px-4 py-2.5 text-sm text-white/80 hover:bg-purple-600/20 hover:text-white transition-all w-full text-left"
          >
            forgot code?
          </button>
        </div>
      )}

      {denyNotice && (
        <div
          className={`fixed top-6 left-1/2 z-50 px-5 py-3 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 text-sm shadow-2xl backdrop-blur-md ${
            denyFading ? 'animate-fade-out-up' : 'animate-fade-in'
          }`}
          style={{ transform: 'translateX(-50%)' }}
        >
          we do not detect an recent account from you. Pay up.
        </div>
      )}
    </div>
  );
}
