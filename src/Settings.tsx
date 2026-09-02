import React, { useState, useEffect, useRef } from 'react';
import { launchAboutBlankCloak } from './cloak';
import { THEMES, applyTheme } from './theme';
import { BACKGROUNDS, applyBackground, type BackgroundId } from './background';
import { TAB_CLOAKS, applyTabCloak } from './tabcloak';
import { SEARCH_ENGINES } from './engines';

interface SettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

interface SettingsData {
  browserType: string;
  disableTypingAnimation: boolean;
  autoLoginPage: boolean;
  aboutBlankTab: boolean;
  theme: string;
  background: BackgroundId;
  backgroundUpload: string;
  tabCloak: string;
  panicKey: string;
  panicUrl: string;
  closeProtection: boolean;
  skipLoading: boolean;
}

const defaultSettings: SettingsData = {
  browserType: 'BatNight Engine',
  disableTypingAnimation: false,
  autoLoginPage: true,
  aboutBlankTab: false,
  theme: 'Bat Purple',
  background: 'synthwave',
  backgroundUpload: '',
  tabCloak: 'newtab',
  panicKey: '',
  panicUrl: 'https://www.google.com/',
  closeProtection: false,
  skipLoading: false
};


type SectionId = 'ai' | 'browser' | 'themes' | 'background' | 'cloak';

const SECTIONS: { id: SectionId; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    id: 'ai',
    label: 'AI',
    hint: 'Assistant behaviour',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
      </svg>
    )
  },
  {
    id: 'browser',
    label: 'Browser',
    hint: 'Engine & privacy',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 010 18M12 3a15 15 0 000 18" />
      </svg>
    )
  },
  {
    id: 'themes',
    label: 'Website themes',
    hint: 'Colors & style',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072" />
      </svg>
    )
  },
  {
    id: 'background',
    label: 'Website Background',
    hint: 'Every page',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 21h16.5A1.5 1.5 0 0021.75 19.5V4.5A1.5 1.5 0 0020.25 3H3.75A1.5 1.5 0 002.25 4.5v15A1.5 1.5 0 003.75 21z" />
      </svg>
    )
  },
  {
    id: 'cloak',
    label: 'Tab cloak',
    hint: 'Look harmless',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
      </svg>
    )
  }
];

const PANIC_PRESETS = [
  { label: 'Classroom', url: 'https://classroom.google.com/' },
  { label: 'Docs', url: 'https://docs.google.com/' },
  { label: 'Google', url: 'https://www.google.com/' },
  { label: 'Wikipedia', url: 'https://www.wikipedia.org/' },
  { label: 'Gmail', url: 'https://mail.google.com/' }
];

interface ToggleProps {
  checked: boolean;
  onChange: () => void;
}

const Toggle: React.FC<ToggleProps> = ({ checked, onChange }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    onClick={onChange}
    className={`relative rounded-full transition-all duration-300 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500/50 ${
      checked
        ? 'bg-gradient-to-r from-purple-600 to-indigo-500 shadow-[0_0_12px_rgba(168,85,247,0.45)]'
        : 'bg-white/10 hover:bg-white/15'
    }`}
    style={{ height: '24px', width: '44px' }}
  >
    <span
      className={`absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ${
        checked ? 'left-[23px] w-[18px] h-[18px] bg-white' : 'left-[3px] w-[18px] h-[18px] bg-white/60'
      }`}
    />
  </button>
);

const SettingsRow: React.FC<{ title: string; description: string; children: React.ReactNode; vertical?: boolean }> = ({
  title,
  description,
  children,
  vertical
}) => (
  <div className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 transition-all duration-300 hover:border-white/[0.14] hover:bg-white/[0.05]">
    {vertical ? (
      <div>
        <p className="text-sm font-medium text-white/90">{title}</p>
        <p className="text-xs text-white/40 mt-1 leading-relaxed">{description}</p>
        <div className="mt-3">{children}</div>
      </div>
    ) : (
      <div className="flex items-center justify-between gap-8">
        <div className="min-w-0">
          <p className="text-sm font-medium text-white/90">{title}</p>
          <p className="text-xs text-white/40 mt-1 leading-relaxed">{description}</p>
        </div>
        {children}
      </div>
    )}
  </div>
);

const bgPreview = (id: BackgroundId, upload?: string): React.CSSProperties => {
  if (id === 'anime') return { background: 'url(/backgrounds/animebackground.jpg) center / cover' };
  if (id === 'girl') return { background: 'url(/backgrounds/backgroundgirl.png) center / cover' };
  if (id === 'crows') return { background: 'url(/backgrounds/crows.gif) center / cover' };
  if (id === 'japanese') return { background: 'url(/backgrounds/japanese%20words.png) center / cover' };
  if (id === 'upload' && upload) {
    return { backgroundImage: `url(${upload})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  }
  const designs: Record<string, string> = {
    synthwave: 'linear-gradient(180deg, #1a0533 0%, #4c1d95 40%, #f97316 100%)',
    bokeh: 'radial-gradient(circle at 30% 40%, #fbbf24 0, transparent 40%), radial-gradient(circle at 70% 60%, #a855f7 0, transparent 35%), #0b0b10',
    rain: 'repeating-linear-gradient(110deg, transparent 0 8px, rgba(251,191,36,0.25) 8px 9px), #0b0d12',
    hive: 'radial-gradient(circle, rgba(168,85,247,0.35) 1.5px, transparent 2px)',
    stars: 'radial-gradient(1px 1px at 20% 30%, #fff, transparent), radial-gradient(1px 1px at 70% 60%, #fff, transparent), #07070c',
    grid: 'linear-gradient(rgba(168,85,247,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(168,85,247,0.25) 1px, transparent 1px)',
    upload: '#111118'
  };
  const extra: React.CSSProperties = id === 'hive' ? { backgroundSize: '18px 18px' } : id === 'grid' ? { backgroundSize: '14px 14px' } : {};
  return { background: designs[id] || '#0b0d12', ...extra };
};

const Settings: React.FC<SettingsProps> = ({ isOpen, onClose }) => {
  const [settings, setSettings] = useState<SettingsData>(defaultSettings);
  const [activeSection, setActiveSection] = useState<SectionId>('ai');
  const [saved, setSaved] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const savedSettings = localStorage.getItem('batprox-settings');
    if (savedSettings) {
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(savedSettings) });
      } catch {
        setSettings(defaultSettings);
      }
    } else {
      setSettings(defaultSettings);
    }
  }, [isOpen]);

  const updateSettings = (next: SettingsData) => {
    setSettings(next);
    localStorage.setItem('batprox-settings', JSON.stringify(next));
    applyTheme(next.theme);
    applyBackground();
    applyTabCloak();
    setSaved(true);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    savedTimerRef.current = setTimeout(() => setSaved(false), 1500);
    if (next.aboutBlankTab && !settings.aboutBlankTab) {
      launchAboutBlankCloak();
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const activeMeta = SECTIONS.find((s) => s.id === activeSection)!;

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 1800000) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateSettings({ ...settings, background: 'upload', backgroundUpload: String(reader.result || '') });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl h-[600px] rounded-3xl overflow-hidden border border-white/10 shadow-[0_25px_80px_-20px_rgba(0,0,0,0.9)] flex bg-[#0a0a10]/95 backdrop-blur-2xl animate-settings-pop">
        <div className="w-60 shrink-0 border-r border-white/[0.06] p-5 flex flex-col bg-white/[0.015]">
          <div className="flex items-center justify-between mb-7 px-1">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-600/25">
                <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-white">Settings</h2>
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg flex items-center justify-center text-white/30 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <nav className="space-y-1.5 overflow-y-auto">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all duration-200 ${
                  activeSection === section.id
                    ? 'bg-gradient-to-r from-purple-600/25 to-indigo-600/15 text-white border border-purple-500/25 shadow-lg shadow-purple-900/20'
                    : 'text-white/45 hover:text-white/85 hover:bg-white/[0.04] border border-transparent'
                }`}
              >
                <span className={activeSection === section.id ? 'text-purple-300' : 'text-white/30'}>
                  {section.icon}
                </span>
                <span className="flex flex-col">
                  <span className="text-[13px] font-medium leading-tight">{section.label}</span>
                  <span className="text-[10px] text-white/25 leading-tight mt-0.5">{section.hint}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto pt-4 border-t border-white/[0.06] px-1">
            <p className="text-[11px] text-white/25 flex items-center gap-1.5">
              {saved ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-green-400/80">Saved</span>
                </>
              ) : (
                <>
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Saved automatically
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-7 pt-6 pb-4 border-b border-white/[0.06] flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold text-white">{activeMeta.label}</h3>
              <p className="text-xs text-white/35 mt-0.5">{activeMeta.hint}</p>
            </div>
            {saved && (
              <span className="text-[11px] text-green-400/90 bg-green-500/10 border border-green-500/20 rounded-full px-3 py-1">
                Saved
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-7 py-6">
            {activeSection === 'ai' && (
              <div className="space-y-3 max-w-2xl">
                <SettingsRow
                  title="Disable typing animation response"
                  description="AI will send messages instantly without the typing effect."
                >
                  <Toggle
                    checked={settings.disableTypingAnimation}
                    onChange={() => updateSettings({ ...settings, disableTypingAnimation: !settings.disableTypingAnimation })}
                  />
                </SettingsRow>
              </div>
            )}

            {activeSection === 'browser' && (
              <div className="space-y-3 max-w-2xl">
                <SettingsRow title="Search engine" description="Used when you search instead of typing a web address." vertical>
                  <div className="relative">
                    <select
                      value={settings.browserType}
                      onChange={(e) => updateSettings({ ...settings, browserType: e.target.value })}
                      className="w-full appearance-none px-4 py-2.5 pr-10 rounded-xl bg-white/[0.05] border border-white/10 text-white text-[13px] focus:outline-none focus:border-purple-500/60 cursor-pointer"
                    >
                      {SEARCH_ENGINES.map((engine) => (
                        <option key={engine} value={engine}>{engine}</option>
                      ))}
                    </select>
                    <svg className="w-4 h-4 text-white/40 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </SettingsRow>

                <SettingsRow title="Auto login page" description="Once you leave the tab or website, it detects that and instantly goes back to the login page.">
                  <Toggle
                    checked={settings.autoLoginPage}
                    onChange={() => updateSettings({ ...settings, autoLoginPage: !settings.autoLoginPage })}
                  />
                </SettingsRow>

                <SettingsRow title="about:blank tab" description="Opens the site in an invisible about:blank tab so teachers can't see your screen.">
                  <Toggle
                    checked={settings.aboutBlankTab}
                    onChange={() => updateSettings({ ...settings, aboutBlankTab: !settings.aboutBlankTab })}
                  />
                </SettingsRow>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4">
                  <p className="text-sm font-medium text-white/90 flex items-center gap-2">
                    <span className="text-purple-300">!</span> Panic Button
                  </p>
                  <p className="text-xs text-white/40 mt-1 mb-4">Hit your hotkey to instantly bail to a safe site.</p>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Hotkey</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    <input
                      type="text"
                      readOnly
                      value={capturing ? 'press any key...' : (settings.panicKey || '')}
                      onKeyDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
                        const combo = `${e.ctrlKey ? 'Ctrl+' : ''}${e.altKey ? 'Alt+' : ''}${e.shiftKey ? 'Shift+' : ''}${e.key}`;
                        updateSettings({ ...settings, panicKey: combo });
                        setCapturing(false);
                        (e.target as HTMLInputElement).blur();
                      }}
                      onFocus={() => setCapturing(true)}
                      placeholder="not set"
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 min-w-[130px] text-center focus:outline-none focus:border-purple-500/60 cursor-pointer"
                    />
                    <button
                      type="button"
                      onClick={() => updateSettings({ ...settings, panicKey: '' })}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10"
                    >
                      Clear
                    </button>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-white/30 mb-2">Panic URL</p>
                  <input
                    value={settings.panicUrl}
                    onChange={(e) => updateSettings({ ...settings, panicUrl: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-white/[0.05] border border-white/10 text-sm text-white mb-3 focus:outline-none focus:border-purple-500/50"
                  />
                  <div className="flex flex-wrap gap-2 mb-3">
                    {PANIC_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => updateSettings({ ...settings, panicUrl: p.url })}
                        className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-white/70 hover:bg-white/10"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateSettings({ ...settings })}
                      className="px-3 py-1.5 rounded-lg bg-purple-600/20 border border-purple-500/30 text-xs text-purple-200"
                    >
                      Save URL
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(settings.panicUrl || 'https://www.google.com/', '_blank')}
                      className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-white/70"
                    >
                      Test
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-5 py-4 space-y-4">
                  <div>
                    <p className="text-sm font-medium text-white/90">Behavior</p>
                    <p className="text-xs text-white/40 mt-1">Small quality-of-life toggles.</p>
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm text-white/90">Close protection</p>
                      <p className="text-xs text-white/40 mt-0.5">Warn before closing the tab</p>
                    </div>
                    <Toggle
                      checked={settings.closeProtection}
                      onChange={() => updateSettings({ ...settings, closeProtection: !settings.closeProtection })}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-6">
                    <div>
                      <p className="text-sm text-white/90">Skip loading</p>
                      <p className="text-xs text-white/40 mt-0.5">Skip the startup animation</p>
                    </div>
                    <Toggle
                      checked={settings.skipLoading}
                      onChange={() => updateSettings({ ...settings, skipLoading: !settings.skipLoading })}
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSection === 'themes' && (
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-white/90 mb-1">Pick a theme</p>
                <p className="text-xs text-white/40 mb-5">The whole website recolors instantly.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {THEMES.map((t) => {
                    const active = settings.theme === t.name;
                    return (
                      <button
                        key={t.name}
                        onClick={() => updateSettings({ ...settings, theme: t.name })}
                        className={`rounded-2xl border p-3.5 text-left transition-all duration-300 ${
                          active
                            ? 'border-purple-500/60 bg-purple-600/10 shadow-lg shadow-purple-900/30'
                            : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                        }`}
                      >
                        <div
                          className="w-full h-9 rounded-xl mb-3 border border-white/10"
                          style={{ background: t.preview }}
                        />
                        <span className={`text-xs font-medium ${active ? 'text-white' : 'text-white/70'}`}>{t.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {activeSection === 'background' && (
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-white/90 mb-1">Pick a background or a custom background. This applies to every page.</p>
                <p className="text-xs text-white/40 mb-5">Designs tint to your theme.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {BACKGROUNDS.map((b) => {
                    const active = settings.background === b.id;
                    return (
                      <button
                        key={b.id}
                        onClick={() => {
                          if (b.id === 'upload') {
                            fileRef.current?.click();
                            return;
                          }
                          updateSettings({ ...settings, background: b.id });
                        }}
                        className={`rounded-2xl border p-2.5 text-left transition-all ${
                          active ? 'border-amber-400/70 bg-amber-500/10' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                        }`}
                      >
                        <div className="w-full h-16 rounded-xl mb-2 border border-white/10" style={bgPreview(b.id, settings.backgroundUpload)} />
                        <span className={`text-xs font-medium ${active ? 'text-white' : 'text-white/70'}`}>{b.name}</span>
                      </button>
                    );
                  })}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onUpload} />
              </div>
            )}

            {activeSection === 'cloak' && (
              <div className="max-w-2xl">
                <p className="text-sm font-medium text-white/90 mb-1">Make BatProx your own set, in your tab bar and look harmless.</p>
                <p className="text-xs text-white/40 mb-5">Changes the tab title and icon instantly.</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {TAB_CLOAKS.map((c) => {
                    const active = settings.tabCloak === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => updateSettings({ ...settings, tabCloak: c.id })}
                        className={`rounded-2xl border p-3 text-left flex items-center gap-3 transition-all ${
                          active ? 'border-purple-500/60 bg-purple-600/10' : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20'
                        }`}
                      >
                        <img src={c.icon} alt="" className="w-6 h-6 rounded-sm object-contain bg-white/90" />
                        <span className={`text-xs font-medium truncate ${active ? 'text-white' : 'text-white/70'}`}>{c.title}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
