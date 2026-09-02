export interface Theme {
  name: string;
  accent: string;
  accent2: string;
  glow: string;
  preview: string;
}

export const THEMES: Theme[] = [
  { name: 'Bat Purple', accent: '#c084fc', accent2: '#818cf8', glow: '168, 85, 247', preview: 'linear-gradient(135deg, #c084fc, #6366f1)' },
  { name: 'Cyberpunk Neon', accent: '#22d3ee', accent2: '#e879f9', glow: '34, 211, 238', preview: 'linear-gradient(135deg, #22d3ee, #e879f9 55%, #f43f5e)' },
  { name: 'Ocean Deep', accent: '#38bdf8', accent2: '#22d3ee', glow: '14, 165, 233', preview: 'linear-gradient(135deg, #38bdf8, #0e7490)' },
  { name: 'Emerald Forest', accent: '#34d399', accent2: '#4ade80', glow: '16, 185, 129', preview: 'linear-gradient(135deg, #34d399, #047857)' },
  { name: 'Sunset Blaze', accent: '#fb7185', accent2: '#fb923c', glow: '244, 63, 94', preview: 'linear-gradient(135deg, #fb923c, #e11d48)' },
  { name: 'Aurora Borealis', accent: '#a78bfa', accent2: '#34d399', glow: '167, 139, 250', preview: 'linear-gradient(135deg, #67e8f9, #a78bfa, #34d399)' },
  { name: 'Cherry Blossom', accent: '#f9a8d4', accent2: '#fb7185', glow: '244, 114, 182', preview: 'linear-gradient(135deg, #fecdd3, #f9a8d4, #c084fc)' },
  { name: 'Midnight Silver', accent: '#e5e7eb', accent2: '#93c5fd', glow: '148, 163, 184', preview: 'linear-gradient(135deg, #e5e7eb, #64748b)' },
  { name: 'Golden Hour', accent: '#fbbf24', accent2: '#fb923c', glow: '245, 158, 11', preview: 'linear-gradient(135deg, #fde68a, #f59e0b)' }
];

export function applyTheme(name: string) {
  const theme = THEMES.find(t => t.name === name) || THEMES[0];
  const root = document.documentElement;
  root.style.filter = 'none';
  document.body.style.filter = 'none';
  document.body.style.transition = 'background-color 0.45s ease, color 0.45s ease';
  root.setAttribute('data-theme', theme.name);
  root.style.setProperty('--bp-accent', theme.accent);
  root.style.setProperty('--bp-accent-2', theme.accent2);
  root.style.setProperty('--bp-glow', theme.glow);
  window.dispatchEvent(new CustomEvent('bp-theme'));
}

export function getSavedTheme() {
  try {
    const s = JSON.parse(localStorage.getItem('batprox-settings') || '{}');
    return s.theme || 'Bat Purple';
  } catch {
    return 'Bat Purple';
  }
}
