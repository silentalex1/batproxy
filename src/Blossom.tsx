import { Component, useMemo } from 'react';
import type { ReactNode } from 'react';

class BlossomBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {}
  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

const num = (v: number, min: number, max: number) =>
  Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : (min + max) / 2;

export default function Blossom() {
  const petals = useMemo(
    () =>
      Array.from({ length: 26 }, () => {
        const roll = Math.random();
        const depth = roll < 0.2 ? 'close' : roll < 0.45 ? 'far' : 'mid';
        return {
          left: num(Math.random() * 100, 0, 99),
          size: num(depth === 'close' ? 20 + Math.random() * 10 : depth === 'far' ? 4 + Math.random() * 3 : 9 + Math.random() * 10, 3, 30),
          duration: num(depth === 'close' ? 7 + Math.random() * 4 : depth === 'far' ? 16 + Math.random() * 8 : 10 + Math.random() * 9, 5, 30),
          delay: -num(Math.random() * 22, 0, 22),
          sway: num(depth === 'close' ? 60 + Math.random() * 50 : 25 + Math.random() * 45, 20, 120),
          opacity: num(depth === 'close' ? 0.9 : depth === 'far' ? 0.4 : 0.75, 0.3, 0.95),
          blur: depth === 'close' ? num(2 + Math.random() * 1.5, 1, 4) : 0
        };
      }),
    []
  );

  const flowers = useMemo(() => {
    const list: Array<{ x: number; y: number; s: number }> = [];
    const clusters = [70, 300, 560, 860, 1140, 1370];
    clusters.forEach((cx) => {
      const count = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < count; j++) {
        list.push({
          x: num(cx + (Math.random() - 0.5) * 130, 0, 1440),
          y: num(70 + Math.random() * 32, 60, 105),
          s: num(0.7 + Math.random() * 0.8, 0.5, 1.6)
        });
      }
    });
    return list;
  }, []);

  return (
    <BlossomBoundary>
      <div aria-hidden>
        <div className="fixed inset-x-0 bottom-0 z-0 pointer-events-none select-none">
          <svg viewBox="0 0 1440 120" preserveAspectRatio="none" className="w-full h-20 sm:h-28 block">
            <path d="M0 120 L0 94 Q90 62 180 90 Q270 116 360 86 Q450 60 540 88 Q630 116 720 84 Q810 58 900 90 Q990 118 1080 88 Q1170 62 1260 90 Q1350 116 1440 88 L1440 120 Z" fill="#241238" opacity="0.9" />
            <path d="M0 120 L0 106 Q120 82 240 104 Q360 122 480 100 Q600 82 720 104 Q840 122 960 100 Q1080 82 1200 104 Q1320 120 1440 102 L1440 120 Z" fill="#180b28" opacity="0.95" />
            {flowers.map((f, i) => (
              <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.s})`}>
                {[0, 60, 120, 180, 240, 300].map((a) => (
                  <ellipse key={a} cx="0" cy="-8" rx="4.2" ry="7.5" fill="#f5d0fe" opacity="0.95" transform={`rotate(${a})`} />
                ))}
                {[15, 105, 195, 285, 345].map((a) => (
                  <ellipse key={a} cx="0" cy="-4.5" rx="2.6" ry="4.5" fill="#f0abfc" transform={`rotate(${a})`} />
                ))}
                <circle cx="0" cy="0" r="2.4" fill="#fce7f3" />
                <circle cx="0" cy="0" r="1.2" fill="#a855f7" />
              </g>
            ))}
          </svg>
        </div>

        <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
          {petals.map((p, i) => (
            <span
              key={i}
              className="bp-petal"
              style={
                {
                  left: p.left + '%',
                  width: p.size + 'px',
                  height: Math.round(p.size * 0.78) + 'px',
                  animationDuration: p.duration + 's',
                  animationDelay: p.delay + 's',
                  opacity: p.opacity,
                  filter: p.blur ? `blur(${p.blur}px)` : undefined,
                  '--sway': p.sway + 'px'
                } as React.CSSProperties
              }
            />
          ))}
        </div>
      </div>
    </BlossomBoundary>
  );
}
