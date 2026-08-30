export type BackgroundId = 'anime' | 'girl' | 'crows' | 'japanese' | 'synthwave' | 'bokeh' | 'rain' | 'hive' | 'stars' | 'grid' | 'upload';

export const BACKGROUNDS: { id: BackgroundId; name: string; kind: 'image' | 'design' | 'upload' }[] = [
  { id: 'anime', name: 'anime background', kind: 'image' },
  { id: 'girl', name: 'for the girls', kind: 'image' },
  { id: 'crows', name: 'crows', kind: 'image' },
  { id: 'japanese', name: 'random japanese/chinese words', kind: 'image' },
  { id: 'synthwave', name: 'Synthwave', kind: 'design' },
  { id: 'bokeh', name: 'Bokeh', kind: 'design' },
  { id: 'rain', name: 'Rain', kind: 'design' },
  { id: 'hive', name: 'Hive', kind: 'design' },
  { id: 'stars', name: 'Stars', kind: 'design' },
  { id: 'grid', name: 'Grid', kind: 'design' },
  { id: 'upload', name: 'Upload', kind: 'upload' }
];

function readSettings() {
  try {
    return JSON.parse(localStorage.getItem('batprox-settings') || '{}');
  } catch {
    return {};
  }
}

const DESIGNS: Record<string, string> = {
  synthwave: 'linear-gradient(180deg, #12041f 0%, #2a0a4a 35%, #6d28d9 70%, #f97316 130%)',
  bokeh: 'radial-gradient(circle at 25% 35%, rgba(251,191,36,0.28) 0, transparent 28%), radial-gradient(circle at 70% 60%, rgba(168,85,247,0.25) 0, transparent 30%), radial-gradient(circle at 55% 20%, rgba(59,130,246,0.18) 0, transparent 26%), #0b0b10',
  rain: 'repeating-linear-gradient(110deg, transparent 0 26px, rgba(168,85,247,0.10) 26px 27px, transparent 27px 54px, rgba(255,255,255,0.06) 54px 55px), #08080d',
  hive: 'radial-gradient(circle, rgba(168,85,247,0.30) 1.6px, transparent 2.2px), #08080d',
  stars: 'radial-gradient(1.2px 1.2px at 12% 22%, #fff, transparent), radial-gradient(1px 1px at 34% 68%, #fff, transparent), radial-gradient(1.4px 1.4px at 58% 14%, #fff, transparent), radial-gradient(1px 1px at 72% 44%, #fff, transparent), radial-gradient(1.3px 1.3px at 88% 76%, #fff, transparent), radial-gradient(1px 1px at 44% 88%, #fff, transparent), #050509',
  grid: 'linear-gradient(rgba(168,85,247,0.14) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.14) 1px, transparent 1px), #06060b'
};

export function applyBackground() {
  const s = readSettings();
  const id: BackgroundId = s.background || 'synthwave';
  const root = document.documentElement;
  root.setAttribute('data-bp-bg', id);
  root.setAttribute('data-bp-has-bg', '1');
  let layer = document.getElementById('bp-bg-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'bp-bg-layer';
    document.body.prepend(layer);
  }
  layer.className = 'bp-bg-layer bp-bg-scrim';
  layer.style.filter = '';
  if (id === 'anime') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/animebackground.jpg) center / cover no-repeat fixed';
  } else if (id === 'girl') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/backgroundgirl.png) center / cover no-repeat fixed';
  } else if (id === 'crows') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/crows.gif) center / cover no-repeat fixed';
  } else if (id === 'japanese') {
    layer.style.background = 'linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(/backgrounds/japanese%20words.png) center / cover no-repeat fixed';
  } else if (id === 'upload' && s.backgroundUpload) {
    layer.style.background = `linear-gradient(rgba(5,5,12,0.58), rgba(5,5,12,0.64)), url(${s.backgroundUpload}) center / cover no-repeat fixed`;
  } else {
    layer.style.background = DESIGNS[id] || '';
    layer.style.backgroundSize = id === 'hive' ? '18px 18px' : id === 'grid' ? '14px 14px' : '';
  }
}
