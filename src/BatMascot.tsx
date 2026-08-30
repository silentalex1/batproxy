import { useEffect, useRef } from 'react';

interface BatMascotProps {
  size?: number;
}

export default function BatMascot({ size = 80 }: BatMascotProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const leftEyeRef = useRef<SVGGElement>(null);
  const rightEyeRef = useRef<SVGGElement>(null);
  const target = useRef({ x: 0, y: 0 });
  const current = useRef({ x: 0, y: 0 });
  const blink = useRef({ active: false, start: 0, duration: 220, next: performance.now() + 2500 });
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return;
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.hypot(dx, dy) || 1;
      const reach = Math.min(dist / 60, 1);
      target.current = { x: (dx / dist) * reach * 3.2, y: (dy / dist) * reach * 2.8 };
    };

    const applyEyes = (now: number) => {
      current.current.x += (target.current.x - current.current.x) * 0.14;
      current.current.y += (target.current.y - current.current.y) * 0.14;
      const track = `translate(${current.current.x.toFixed(2)} ${current.current.y.toFixed(2)})`;

      let scaleY = 1;
      const b = blink.current;
      if (!b.active && now >= b.next) {
        b.active = true;
        b.start = now;
      }
      if (b.active) {
        const p = (now - b.start) / b.duration;
        if (p >= 1) {
          b.active = false;
          b.next = now + 2200 + Math.random() * 3800;
        } else {
          const ease = p < 0.4 ? p / 0.4 : 1 - (p - 0.4) / 0.6;
          scaleY = Math.max(0.06, 1 - ease);
        }
      }

      const squash = (el: SVGGElement | null, cx: number, cy: number) => {
        if (!el) return;
        el.setAttribute('transform', `${track} translate(${cx} ${cy}) scale(1 ${scaleY.toFixed(3)}) translate(${-cx} ${-cy})`);
      };
      squash(leftEyeRef.current, 39, 55.3);
      squash(rightEyeRef.current, 61, 55.3);
    };

    const loop = (now: number) => {
      applyEyes(now);
      rafRef.current = requestAnimationFrame(loop);
    };
    window.addEventListener('mousemove', onMove);
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <svg ref={svgRef} width={size} height={size} viewBox="-6 0 112 100" fill="none">
      <defs>
        <filter id="slitGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
      </defs>
      <path d="M30 50 C16 44 2 44 -4 54 L6 55 C2 60 3 67 9 71 L7 77 C15 80 24 78 29 72 C31 64 31 56 30 50 Z" fill="#1c1533" stroke="#a855f7" strokeOpacity="0.4" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M22 56 C14 53 7 54 3 58" stroke="#a855f7" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M21 64 C15 63 10 66 8 70" stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M70 50 C84 44 98 44 104 54 L94 55 C98 60 97 67 91 71 L93 77 C85 80 76 78 71 72 C69 64 69 56 70 50 Z" fill="#1c1533" stroke="#a855f7" strokeOpacity="0.4" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M78 56 C86 53 93 54 97 58" stroke="#a855f7" strokeOpacity="0.35" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M79 64 C85 63 90 66 92 70" stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1.2" strokeLinecap="round" fill="none" />
      <path d="M19 26 C20 15 27 7.5 36 5 C43 3.2 50 3.2 56 5.5 C62 8 66 11.5 68 15.5" stroke="#F5F2FF" strokeWidth="4.5" strokeLinecap="round" fill="none" />
      <path d="M21 28 C23 18 28 10.5 37 8.2 C43 6.5 49 6.5 54.5 8.5" stroke="#c9c2e0" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />
      <path d="M 24,48 C 16,44 10.5,36 12,27 L 14.5,24.5 C 19,25.5 24,29 30,31.5 C 33.5,30 38,29 43,28.6 C 46,28.3 49.5,28 52,28 C 54.5,20 57.5,12 61.5,5.5 L 65,9 C 70,16 73.5,26 75.5,35 C 78,39 80,43 80,46 C 85,53 87,65 83,74 C 77,84 65,88.5 50,88.5 C 35,88.5 23,84 17,74 C 13,66 15,55 24,48 Z" fill="#0B0B12" stroke="#a855f7" strokeOpacity="0.5" strokeWidth="1.6" strokeLinejoin="round" />
      <g transform="rotate(-90 19 31)">
        <rect x="12" y="22" width="14" height="18" rx="7" fill="#F5F2FF" stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1" />
        <rect x="16.75" y="24" width="4.5" height="7.5" rx="2.25" fill="#a855f7" opacity="0.55" />
        <circle cx="14.5" cy="37.5" r="1" fill="#c9c2e0" />
        <circle cx="23.5" cy="37.5" r="1" fill="#c9c2e0" />
      </g>
      <g transform="rotate(-8 60 22)">
        <rect x="52.5" y="13" width="15" height="18" rx="7.5" fill="#F5F2FF" stroke="#a855f7" strokeOpacity="0.3" strokeWidth="1" />
        <rect x="56.5" y="17.5" width="4.5" height="9.5" rx="2.25" fill="#a855f7" opacity="0.55" />
        <circle cx="55.5" cy="16" r="1" fill="#c9c2e0" />
        <circle cx="55.5" cy="28" r="1" fill="#c9c2e0" />
      </g>
      <path d="M10 34 C8 38 8 42 10 45" stroke="#F5F2FF" strokeWidth="2" strokeLinecap="round" fill="none" />
      <circle cx="10.5" cy="46.5" r="2.2" fill="#F5F2FF" />
      <ellipse cx="29" cy="66" rx="4.5" ry="2.8" fill="#f472b6" opacity="0.32" />
      <ellipse cx="71" cy="66" rx="4.5" ry="2.8" fill="#f472b6" opacity="0.32" />
      <g ref={leftEyeRef}>
        <rect x="31" y="53" width="16" height="4.6" rx="2.3" transform="rotate(8 39 55.3)" fill="#a855f7" filter="url(#slitGlow)" opacity="0.7" />
        <rect x="31" y="53" width="16" height="4.6" rx="2.3" transform="rotate(8 39 55.3)" fill="#ffffff" />
      </g>
      <g ref={rightEyeRef}>
        <rect x="53" y="53" width="16" height="4.6" rx="2.3" transform="rotate(-8 61 55.3)" fill="#a855f7" filter="url(#slitGlow)" opacity="0.7" />
        <rect x="53" y="53" width="16" height="4.6" rx="2.3" transform="rotate(-8 61 55.3)" fill="#ffffff" />
      </g>
    </svg>
  );
}
