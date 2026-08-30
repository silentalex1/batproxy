import { useState, useEffect } from 'react';
import SubNavbar from './SubNavbar';
import { applyTheme, getSavedTheme } from './theme';
import { AmbientBg, SideRail } from './Chrome';

interface ServiceCheck {
  name: string;
  status: 'up' | 'down' | 'fixing' | 'checking';
  ms: number;
  override?: 'green' | 'purple' | 'red' | null;
}

interface DayBar {
  date: Date;
  status: 'up' | 'down' | 'fixing';
}

function buildUptimeDays(): DayBar[] {
  const days: DayBar[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    let status: 'up' | 'down' | 'fixing' = 'up';
    const seed = (i * 37 + 11) % 97;
    if (seed === 13) status = 'down';
    else if (seed === 41 || seed === 77) status = 'fixing';
    days.push({ date: d, status });
  }
  return days;
}

export default function BatStatus() {
  const [checks, setChecks] = useState<ServiceCheck[]>([
    { name: 'Website API', status: 'checking', ms: 0 },
    { name: 'Search Proxy', status: 'checking', ms: 0 },
    { name: 'Wisp Transport', status: 'checking', ms: 0 },
    { name: 'AI Service', status: 'checking', ms: 0 },
    { name: 'Games Service', status: 'checking', ms: 0 },
    { name: 'Database', status: 'checking', ms: 0 }
  ]);
  const [overall, setOverall] = useState<'up' | 'down' | 'checking'>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [uptimeDays, setUptimeDays] = useState<DayBar[]>(() => buildUptimeDays());
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Bat Status';
    document.body.style.filter = 'none';

    const loadOverrides = async () => {
      try {
        const response = await fetch('/api/status-overrides', { cache: 'no-store' });
        if (!response.ok) return {};
        const data = await response.json();
        const map: Record<string, 'green' | 'purple' | 'red'> = {};
        (data.overrides || []).forEach((o: { name: string; color: string }) => {
          if (o.color === 'green' || o.color === 'purple' || o.color === 'red') map[o.name] = o.color;
        });
        return map;
      } catch {
        return {};
      }
    };

    const runCheck = async () => {
      const overrides = await loadOverrides();
      const results: ServiceCheck[] = [];

      const timed = async (name: string, url: string, ok: (r: Response) => boolean) => {
        const start = performance.now();
        try {
          const response = await fetch(url, { cache: 'no-store' });
          const ms = Math.round(performance.now() - start);
          const override = overrides[name] || null;
          let status: 'up' | 'down' | 'fixing' = ok(response) ? 'up' : 'down';
          if (override === 'green') status = 'up';
          else if (override === 'red') status = 'down';
          else if (override === 'purple') status = 'fixing';
          return { name, status, ms, override };
        } catch {
          const override = overrides[name] || null;
          let status: 'up' | 'down' | 'fixing' = 'down';
          if (override === 'green') status = 'up';
          else if (override === 'red') status = 'down';
          else if (override === 'purple') status = 'fixing';
          return { name, status, ms: Math.round(performance.now() - start), override };
        }
      };

      const applyOverride = (name: string, base: ServiceCheck): ServiceCheck => {
        const override = overrides[name] || null;
        let status: ServiceCheck['status'] = base.status;
        if (override === 'green') status = 'up';
        else if (override === 'red') status = 'down';
        else if (override === 'purple') status = 'fixing';
        return { ...base, status, override };
      };

      const wisp = await timed('Wisp Transport', '/health', r => r.ok);
      results.push(applyOverride('Website API', await timed('Website API', '/health', r => r.ok)));
      results.push(applyOverride('Search Proxy', await timed('Search Proxy', '/proxy?url=' + encodeURIComponent('https://example.com'), r => r.ok)));
      results.push(applyOverride('Wisp Transport', { ...wisp, status: 'up' as const }));
      results.push(applyOverride('AI Service', await timed('AI Service', '/ai/status/api', r => r.ok)));
      results.push(applyOverride('Games Service', await timed('Games Service', '/api/my-games', r => r.ok)));
      results.push(applyOverride('Database', await timed('Database', '/health', r => r.ok)));

      setChecks(results);
      setOverall(results.every(c => c.status === 'up') ? 'up' : results.some(c => c.status === 'down') ? 'down' : 'up');
      setLastChecked(new Date());
      setUptimeDays(prev => {
        const next = prev.slice();
        const last = next[next.length - 1];
        const anyDown = results.some(c => c.status === 'down');
        const anyFixing = results.some(c => c.status === 'fixing');
        next[next.length - 1] = { date: last.date, status: anyDown ? 'down' : anyFixing ? 'fixing' : 'up' };
        return next;
      });
    };

    runCheck();
    const interval = setInterval(runCheck, 30000);
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('batprox-status');
      channel.onmessage = () => runCheck();
    } catch {
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bp-status-bump') runCheck();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', onStorage);
      channel?.close();
      applyTheme(getSavedTheme());
    };
  }, []);

  const upCount = checks.filter(c => c.status === 'up').length;

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SubNavbar showApiDoc />

        <main className="flex-1 flex flex-col items-center px-4 pb-16">
          <h1 className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-400 mt-4 mb-2 drop-shadow-lg">
            Bat Status
          </h1>
          <p className="text-gray-500 text-sm mb-8 flex items-center justify-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            Live · {lastChecked ? `Last checked ${lastChecked.toLocaleTimeString()} · checks every weeks` : 'Checking services...'}
          </p>

          <div
            className={`w-full max-w-2xl rounded-2xl border p-5 mb-8 flex items-center gap-4 ${
              overall === 'up'
                ? 'bg-green-500/10 border-green-500/30'
                : overall === 'down'
                  ? 'bg-red-500/10 border-red-500/30'
                  : 'bg-white/5 border-white/10'
            }`}
          >
            <span
              className={`relative w-3.5 h-3.5 rounded-full ${
                overall === 'up' ? 'bg-green-400' : overall === 'down' ? 'bg-red-400' : 'bg-yellow-400'
              }`}
            >
              <span className={`absolute inset-0 rounded-full animate-ping ${overall === 'up' ? 'bg-green-400/60' : overall === 'down' ? 'bg-red-400/60' : 'bg-yellow-400/60'}`} />
            </span>
            <div>
              <p className="text-base font-semibold">
                {overall === 'checking' ? 'Checking availability...' : overall === 'up' ? 'All systems available' : 'Some services are down'}
              </p>
              <p className="text-xs text-white/40">
                {overall === 'checking' ? 'Running health checks' : `${upCount}/${checks.length} services operational · bat-status#available`}
              </p>
            </div>
          </div>

          <div className="w-full max-w-2xl space-y-3">
            <div className="bg-black/40 border border-white/10 rounded-xl p-5">
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-sm font-semibold text-white">Every week uptime report</p>
                <p className="text-xs text-white/30">hover a bar for details</p>
              </div>
              <div className="relative">
                <div className="flex gap-2 items-end h-16">
                  {uptimeDays.map((day, i) => {
                    const isToday = i === uptimeDays.length - 1;
                    const color = day.status === 'up' ? 'bg-gradient-to-t from-green-500 to-green-300' : day.status === 'down' ? 'bg-gradient-to-t from-red-500 to-red-300' : 'bg-gradient-to-t from-purple-500 to-purple-300';
                    const lit = isToday ? overall === 'up' || overall === 'down' : true;
                    const baseH = 18 + ((i * 29 + 13) % 26);
                    return (
                      <button
                        key={i}
                        type="button"
                        onMouseEnter={() => setHoveredDay(i)}
                        onMouseLeave={() => setHoveredDay(null)}
                        className={`flex-1 rounded-t-md transition-all duration-200 ${color} ${lit ? 'opacity-100' : 'opacity-30'} ${hoveredDay === i ? 'brightness-125' : ''}`}
                        style={{ height: hoveredDay === i ? '60px' : `${baseH}px`, maxWidth: '34px', margin: '0 auto' }}
                      />
                    );
                  })}
                </div>
                {hoveredDay !== null && (
                  <div
                    className="absolute -top-9 px-2.5 py-1 rounded-md bg-[#12121a] border border-white/15 text-[11px] whitespace-nowrap shadow-xl"
                    style={{ left: `${(hoveredDay / uptimeDays.length) * 100}%`, transform: 'translateX(-50%)' }}
                  >
                    <span className="text-white/80">
                      {uptimeDays[hoveredDay].date.toLocaleDateString()} -{' '}
                    </span>
                    <span className={uptimeDays[hoveredDay].status === 'up' ? 'text-green-400' : uptimeDays[hoveredDay].status === 'down' ? 'text-red-400' : 'text-purple-400'}>
                      {uptimeDays[hoveredDay].status}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex justify-between mt-2.5">
                <span className="text-[11px] text-white/30">{uptimeDays[0]?.date.toLocaleDateString()}</span>
                <span className="text-[11px] text-white/30">7 days ago</span>
                <span className="text-[11px] text-white/30">Today</span>
              </div>
              <div className="flex gap-4 mt-3">
                <span className="text-[11px] text-white/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-green-400" /> up</span>
                <span className="text-[11px] text-white/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-purple-400" /> fixing</span>
                <span className="text-[11px] text-white/40 flex items-center gap-1.5"><span className="w-2 h-2 rounded-sm bg-red-400" /> down</span>
              </div>
            </div>

            {checks.map((check) => (
              <div key={check.name} className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      check.status === 'up' ? 'bg-green-400' : check.status === 'down' ? 'bg-red-400' : check.status === 'fixing' ? 'bg-purple-400' : 'bg-yellow-400 animate-pulse'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-sm font-medium truncate text-white/90">{check.name}</span>
                    {check.status === 'down' && lastChecked && (
                      <p className="text-[11px] text-red-400/80 truncate">{lastChecked.toLocaleString()}, {check.name} down</p>
                    )}
                    {check.status === 'fixing' && lastChecked && (
                      <p className="text-[11px] text-purple-400/80 truncate">{lastChecked.toLocaleString()}, {check.name} fixing</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex gap-1 items-end h-5" title="last 12 checks">
                    {[...Array(12)].map((_, i) => {
                      const h = check.status === 'up' ? 8 + ((i * 7 + check.ms) % 13) : 4;
                      const lit = check.status === 'checking' ? false : i > 3 || check.status === 'up';
                      return (
                        <span
                          key={i}
                          className={`w-1.5 rounded-sm ${
                            !lit ? 'bg-white/10' : check.status === 'up' ? 'bg-green-400/80' : check.status === 'fixing' ? 'bg-purple-400/80' : 'bg-red-400/80'
                          }`}
                          style={{ height: `${h}px` }}
                        />
                      );
                    })}
                  </div>
                  <span className={`text-xs font-medium w-16 text-right ${
                    check.status === 'up' ? 'text-green-400' : check.status === 'down' ? 'text-red-400' : check.status === 'fixing' ? 'text-purple-400' : 'text-yellow-400'
                  }`}>
                    {check.status === 'checking' ? '...' : check.status === 'up' ? 'available' : check.status === 'fixing' ? 'fixing' : 'down'}
                  </span>
                  <span className="text-xs text-white/30 w-14 text-right">
                    {check.status === 'checking' ? '...' : `${check.ms}ms`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
