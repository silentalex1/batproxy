import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MOVIES_URL } from './engines';

export function AmbientBg() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }}
      />
      <div
        className="absolute inset-0 opacity-80"
        style={{
          backgroundImage: `radial-gradient(1px 1px at 18% 22%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 72% 18%, #fff, transparent),
            radial-gradient(1px 1px at 44% 64%, #fff, transparent),
            radial-gradient(1.4px 1.4px at 88% 48%, #ddd, transparent),
            radial-gradient(1px 1px at 12% 78%, #fff, transparent),
            radial-gradient(1.2px 1.2px at 62% 86%, #fff, transparent)`
        }}
      />
      <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[42rem] h-[22rem] rounded-full blur-[120px]" style={{ background: 'rgba(var(--bp-glow), 0.28)' }} />
      <div className="absolute top-[-8rem] left-1/2 -translate-x-1/2 w-[28rem] h-[16rem] rounded-full blur-[110px]" style={{ background: 'rgba(var(--bp-glow), 0.16)' }} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgba(0,0,0,0.35)_62%,#000_100%)]" />
    </div>
  );
}

export function BatteryIndicator() {
  const [state, setState] = useState<{ level: number; charging: boolean } | null>(null);

  useEffect(() => {
    let battery: any = null;
    const update = () => {
      if (!battery) return;
      setState({ level: Math.round(battery.level * 100), charging: !!battery.charging });
    };
    const nav = navigator as any;
    if (typeof nav.getBattery !== 'function') return;
    nav
      .getBattery()
      .then((b: any) => {
        battery = b;
        update();
        b.addEventListener('levelchange', update);
        b.addEventListener('chargingchange', update);
      })
      .catch(() => {});
    return () => {
      if (battery) {
        battery.removeEventListener('levelchange', update);
        battery.removeEventListener('chargingchange', update);
      }
    };
  }, []);

  if (!state) return null;
  const tone =
    state.charging || state.level > 50
      ? 'text-sky-300'
      : state.level > 20
        ? 'text-amber-300'
        : 'text-rose-400';

  return (
    <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#14141a] shadow-lg ${tone}`}>
      <svg className="w-5 h-5" viewBox="0 0 28 16" fill="none">
        <rect x="0.75" y="0.75" width="23" height="14.5" rx="3.5" stroke="currentColor" strokeWidth="1.6" />
        <rect x="25" y="5" width="2.5" height="6" rx="1.25" fill="currentColor" />
        <rect x="3" y="3" width={Math.max(2, (state.level / 100) * 18.5)} height="10" rx="1.8" fill="currentColor" />
        {state.charging && (
          <path
            d="M13.5 3.5 L10.5 8.5 H12.8 L11.5 12.8 L15.8 7.2 H13.3 L14.6 3.5 Z"
            fill="#0b0b10"
            stroke="currentColor"
            strokeWidth="0.8"
            strokeLinejoin="round"
          />
        )}
      </svg>
      <span className="text-sm font-semibold tabular-nums tracking-wide">{state.level}%</span>
    </div>
  );
}

type RailId = 'home' | 'search' | 'games' | 'movies' | 'chat' | 'settings';

const RAIL: { id: RailId; label: string; icon: React.ReactNode }[] = [
  {
    id: 'home',
    label: 'Home',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1h-5v-6H9v6H4a1 1 0 01-1-1v-9.5z" />
      </svg>
    )
  },
  {
    id: 'search',
    label: 'Search',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
      </svg>
    )
  },
  {
    id: 'games',
    label: 'Games',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h4M8 10v4m7-1h.01M17.5 11h.01M7 7h10a4 4 0 014 4v2a4.5 4.5 0 01-7.5 3.3L12 15l-1.5 1.3A4.5 4.5 0 013 13v-2a4 4 0 014-4z" />
      </svg>
    )
  },
  {
    id: 'movies',
    label: 'Movies',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path strokeLinecap="round" d="M7 5v14M17 5v14M3 9h18M3 15h18" />
      </svg>
    )
  },
  {
    id: 'chat',
    label: 'Chat',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M21 12a9 9 0 11-3.3-6.9L21 6v6z" />
      </svg>
    )
  }
];

export function NavBtn({
  children,
  onClick,
  tone = 'default',
  className = ''
}: {
  children: React.ReactNode;
  onClick?: () => void;
  tone?: 'default' | 'danger' | 'movies';
  className?: string;
}) {
  const tones = {
    default: 'text-white/80 hover:text-white bg-[#14141a] hover:bg-[#1c1c24]',
    danger: 'text-rose-300 bg-[#14141a] hover:bg-[#1c1418]',
    movies: 'text-white bg-[#b91c1c] hover:bg-[#dc2626]'
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center justify-center h-10 px-5 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors duration-200 ${tones[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function TopBar({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full px-4 sm:pl-24 sm:pr-6 pt-4">
      <nav className="flex items-center justify-between gap-3 min-h-[3.5rem] px-3 rounded-2xl bg-black/55 backdrop-blur-xl shadow-2xl overflow-x-auto">
        {children}
      </nav>
    </div>
  );
}

export function DashNav({
  username,
  isAdmin,
  onLogout,
  onAdmin,
  onChangelogs,
  onStatus,
  onSuggestions,
  onSettings
}: {
  username: string;
  isAdmin: boolean;
  onLogout: () => void;
  onAdmin: () => void;
  onChangelogs: () => void;
  onStatus: () => void;
  onSuggestions: () => void;
  onSettings: () => void;
}) {
  return (
    <TopBar>
      <div className="flex items-center gap-3 min-w-0">
        <NavBtn tone="danger" onClick={onLogout}>Logout</NavBtn>
        <span className="hidden sm:block w-px h-5 bg-white/10" />
        <span className="hidden sm:flex items-center gap-2 min-w-0">
          <span className="text-[13px] text-white/70 truncate">Welcome, {username}</span>
          {isAdmin && (
            <span className="inline-flex items-center h-6 text-[10px] font-bold tracking-widest px-2 rounded-md bg-emerald-950/80 text-emerald-300">ADMIN</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {isAdmin && <NavBtn onClick={onAdmin}>Admin</NavBtn>}
        <NavBtn onClick={onChangelogs}>Changelogs</NavBtn>
        <NavBtn className="hidden md:inline-flex" onClick={onStatus}>Status</NavBtn>
        <NavBtn className="hidden md:inline-flex" onClick={onSuggestions}>Suggestions</NavBtn>
        <NavBtn onClick={onSettings}>Settings</NavBtn>
        <BatteryIndicator />
      </div>
    </TopBar>
  );
}

export function RotatingTagline({ lines }: { lines: string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      window.setTimeout(() => {
        setIndex((n) => (n + 1) % lines.length);
        setVisible(true);
      }, 280);
    }, 3400);
    return () => clearInterval(id);
  }, [lines.length]);

  return (
    <p className={`text-white/45 text-sm mb-8 h-5 transition-opacity duration-300 ease-in-out ${visible ? 'opacity-100' : 'opacity-0'}`}>
      {lines[index]}
    </p>
  );
}

export function SideRail({ onSettings }: { onSettings?: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;
  const active: RailId =
    path === '/dashboard'
      ? 'home'
      : path === '/search-engine'
        ? 'search'
        : path === '/homework'
          ? 'games'
          : path === '/chatting'
            ? 'chat'
            : 'home';

  const go = (id: RailId) => {
    if (id === 'home') navigate('/dashboard');
    if (id === 'search') navigate('/search-engine');
    if (id === 'games') navigate('/homework#help');
    if (id === 'movies') navigate(`/search-engine?url=${encodeURIComponent(MOVIES_URL)}`);
    if (id === 'chat') navigate('/chatting');
    if (id === 'settings') onSettings?.();
  };

  const itemClass = (on: boolean) =>
    `h-12 w-full rounded-xl flex items-center gap-3 px-3.5 overflow-hidden transition-colors duration-200 ${
      on ? 'text-white bg-white/[0.08]' : 'text-white/50 hover:text-white hover:bg-white/[0.06]'
    }`;

  return (
    <aside className="group/rail fixed left-3 top-1/2 -translate-y-1/2 z-30 hidden sm:flex flex-col gap-1 p-1.5 rounded-2xl bg-black/70 backdrop-blur-xl shadow-2xl w-[3.65rem] hover:w-48 transition-[width] duration-300 ease-in-out overflow-hidden">
      {RAIL.map((item) => (
        <button
          key={item.id}
          title={item.label}
          onClick={() => go(item.id)}
          className={itemClass(active === item.id)}
          style={active === item.id ? { background: 'rgba(var(--bp-glow), 0.28)' } : undefined}
        >
          <span className="shrink-0 w-5 h-5 flex items-center justify-center">{item.icon}</span>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 translate-x-1 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 transition-all duration-300 ease-in-out">
            {item.label}
          </span>
        </button>
      ))}
      <span className="h-px mx-3 my-1 bg-white/10" />
      <button
        title="Settings"
        onClick={() => onSettings?.()}
        className={itemClass(false)}
      >
        <span className="shrink-0 w-5 h-5 flex items-center justify-center">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </span>
        <span className="text-[13px] font-medium whitespace-nowrap opacity-0 translate-x-1 group-hover/rail:opacity-100 group-hover/rail:translate-x-0 transition-all duration-300 ease-in-out">
          Settings
        </span>
      </button>
    </aside>
  );
}
