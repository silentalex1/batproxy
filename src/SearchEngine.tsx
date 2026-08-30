import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Settings from './Settings';
import { initUltraviolet, getUvUrl, getSandboxUrl, decodeProxiedLocation } from './uv';
import { AmbientBg, BatteryIndicator, SideRail } from './Chrome';
import { buildSearchUrl, MOVIES_URL } from './engines';

export default function SearchEngine() {
  const navigate = useNavigate();
  const location = useLocation();
  const [url, setUrl] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [proxySrc, setProxySrc] = useState('');
  const [sandboxSrc, setSandboxSrc] = useState('');
  const [useSandbox, setUseSandbox] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showSitesModal, setShowSitesModal] = useState(false);
  const [sites, setSites] = useState<Array<{ name: string; owner: string; updated_at: string }>>([]);
  const [newSiteName, setNewSiteName] = useState('');
  const [newSiteHtml, setNewSiteHtml] = useState('');
  const [sitesNotice, setSitesNotice] = useState('');
  const [suggestionText, setSuggestionText] = useState('');
  const [userIdentifier] = useState(() => 'user-' + Math.random().toString(36).substr(2, 9));
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const sandboxRef = useRef<HTMLIFrameElement>(null);
  const skipNextLoad = useRef(false);
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadStampRef = useRef(0);

  const clearLoadTimeout = () => {
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
  };

  const armLoadTimeout = () => {
    clearLoadTimeout();
    const stamp = ++loadStampRef.current;
    loadTimeoutRef.current = setTimeout(() => {
      if (loadStampRef.current === stamp) {
        setIsLoading(false);
      }
    }, 3500);
  };

  useEffect(() => {
    initUltraviolet().catch(() => {});
    return () => clearLoadTimeout();
  }, []);

  const skipLoading = (() => {
    try {
      return JSON.parse(localStorage.getItem('batprox-settings') || '{}').skipLoading === true;
    } catch {
      return false;
    }
  })();

  const openTarget = (targetUrl: string, forceSandbox = false) => {
    setUrl(targetUrl);
    setIsLoading(!skipLoading);
    setHasError(false);
    if (forceSandbox) {
      setUseSandbox(true);
      setProxySrc('');
      setSandboxSrc(getSandboxUrl(targetUrl));
      setIframeKey(prev => prev + 1);
      return;
    }
    setUseSandbox(false);
    setProxySrc('');
    setSandboxSrc('');
    initUltraviolet()
      .then(() => {
        if (!skipLoading) armLoadTimeout();
        setProxySrc(getUvUrl(targetUrl));
        setIframeKey(prev => prev + 1);
      })
      .catch(() => {
        setUseSandbox(true);
        setSandboxSrc(getSandboxUrl(targetUrl));
        setIframeKey(prev => prev + 1);
      });
  };

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const targetUrl = searchParams.get('url');
    if (targetUrl) {
      if (skipNextLoad.current) {
        skipNextLoad.current = false;
        setUrl(targetUrl);
        return;
      }
      setHistory(prev => {
        const newHistory = prev.slice(0, historyIndex + 1);
        if (!newHistory.includes(targetUrl)) {
          return [...newHistory, targetUrl];
        }
        return newHistory;
      });
      setHistoryIndex(prev => {
        const newHistory = history.slice(0, prev + 1);
        if (!newHistory.includes(targetUrl)) {
          return newHistory.length;
        }
        return prev;
      });
      openTarget(targetUrl);
    }
  }, [location]);

  useEffect(() => {
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          registrations
            .filter((reg) => reg.scope.includes('/uv'))
            .forEach((reg) => reg.unregister());
        }).catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!event.data || event.data.type !== 'batprox-nav' || !event.data.url) return;
      const nextUrl = event.data.url;
      skipNextLoad.current = true;
      setUrl(nextUrl);
      setHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1);
        if (trimmed[trimmed.length - 1] === nextUrl) return trimmed;
        return [...trimmed, nextUrl];
      });
      setHistoryIndex(prev => prev + 1);
      navigate(`/search-engine?url=${encodeURIComponent(nextUrl)}`);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [historyIndex, navigate]);

  const INTERNAL_ROUTES: Record<string, string> = {
    home: '/dashboard',
    dashboard: '/dashboard',
    games: '/homework#help',
    homework: '/homework#help',
    ai: '/ai-work',
    changelog: '/changelog',
    changelogs: '/changelog',
    status: '/bat-status',
    'api status': '/bat-status',
    movies: '/search-engine?url=' + encodeURIComponent(MOVIES_URL)
  };

  const resolveInternal = (query: string): string | null => {
    const q = query.trim().toLowerCase();
    if (INTERNAL_ROUTES[q]) return INTERNAL_ROUTES[q];
    if (/^(site|mysite):[\w.-]{1,40}$/i.test(q)) return `/site/${q.split(':')[1]}`;
    return null;
  };

  const loadSites = async () => {
    try {
      const response = await fetch('/api/sites');
      if (response.ok) {
        const data = await response.json();
        setSites(data.sites || []);
      }
    } catch {
      setSites([]);
    }
  };

  const saveSite = async () => {
    const name = newSiteName.trim();
    if (!name || !newSiteHtml.trim()) {
      setSitesNotice('Site name and HTML are required.');
      return;
    }
    try {
      const response = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, html: newSiteHtml, owner: localStorage.getItem('batprox-user') || 'anonymous' })
      });
      const data = await response.json();
      if (response.ok) {
        setSitesNotice(`Saved "${name}". Opening it...`);
        setNewSiteName('');
        setNewSiteHtml('');
        setShowSitesModal(false);
        loadSites();
        setTimeout(() => {
          setSitesNotice('');
          navigate(`/search-engine?url=${encodeURIComponent(`/site/${data.name || name}`)}`);
        }, 900);
      } else {
        setSitesNotice(data.error || 'Failed to save site.');
      }
    } catch {
      setSitesNotice('Network error while saving site.');
    }
  };

  const deleteSite = async (name: string) => {
    try {
      const response = await fetch(`/api/sites/${encodeURIComponent(name)}`, { method: 'DELETE' });
      if (response.ok) {
        setSites(prev => prev.filter(s => s.name !== name));
      }
    } catch {
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    const internal = resolveInternal(url);
    if (internal) {
      if (internal.startsWith('/site/')) {
        navigate(`/search-engine?url=${encodeURIComponent(window.location.origin + internal)}`);
      } else {
        navigate(internal);
      }
      return;
    }
    navigate(`/search-engine?url=${encodeURIComponent(buildSearchUrl(url))}`);
  };

  const handleBack = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      navigate(`/search-engine?url=${encodeURIComponent(history[newIndex])}`);
    } else {
      navigate('/dashboard');
    }
  };

  const handleForward = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      navigate(`/search-engine?url=${encodeURIComponent(history[newIndex])}`);
    }
  };

  const handleHome = () => {
    navigate('/dashboard');
  };

  const handleFullscreen = () => {
    const frame = useSandbox ? sandboxRef.current : iframeRef.current;
    if (frame) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        frame.requestFullscreen();
      }
    }
  };

  const handleRefresh = () => {
    const searchParams = new URLSearchParams(location.search);
    const targetUrl = searchParams.get('url') || url;
    if (targetUrl) {
      openTarget(targetUrl, useSandbox);
    }
  };

  const handleIframeLoad = () => {
    clearLoadTimeout();
    setIsLoading(false);
    setHasError(false);
    const frame = useSandbox ? sandboxRef.current : iframeRef.current;
    try {
      const href = frame?.contentWindow?.location.href;
      if (href) {
        const decoded = decodeProxiedLocation(href);
        if (decoded) setUrl(decoded);
      }
    } catch {
    }
  };

  const handleIframeError = () => {
    clearLoadTimeout();
    if (!useSandbox) {
      setUseSandbox(true);
      setSandboxSrc(getSandboxUrl(new URLSearchParams(location.search).get('url') || url));
      setIsLoading(!skipLoading);
      setHasError(false);
      setIframeKey(prev => prev + 1);
      return;
    }
    setIsLoading(false);
    setHasError(true);
  };

  const handleSuggestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (suggestionText.trim()) {
      try {
        const response = await fetch('/api/suggestions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content: suggestionText, userIdentifier }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Suggestion submitted:', data);
          setShowSuggestionsModal(false);
          setSuggestionText('');
          alert('Suggestion submitted successfully!');
        } else {
          const error = await response.json();
          console.error('Submission error:', error);
          alert('Failed to submit suggestion: ' + (error.error || 'Unknown error'));
        }
      } catch (error) {
        console.error('Network error:', error);
        alert('Network error. Please make sure the backend server is running.');
      }
    }
  };

  const searchParams = new URLSearchParams(location.search);
  const targetUrl = searchParams.get('url');

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettingsModal(true)} />

      <main className="relative z-10 flex flex-col h-screen sm:pl-16">
        <div className="flex items-center gap-2 px-3 sm:px-4 py-2.5 border-b border-white/10 bg-black/40 backdrop-blur-xl">
          <div className="flex items-center gap-1">
            <button onClick={handleBack} disabled={historyIndex <= 0} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30" title="Back">←</button>
            <button onClick={handleForward} disabled={historyIndex >= history.length - 1} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10 disabled:opacity-30" title="Forward">→</button>
            <button onClick={handleRefresh} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10" title="Refresh">↻</button>
            <button onClick={handleHome} className="w-8 h-8 rounded-lg text-white/70 hover:bg-white/10" title="Home">⌂</button>
          </div>
          <form onSubmit={handleSearch} className="flex-1">
            <div className="relative flex items-center gap-2 bg-white/[0.06] border border-white/10 rounded-full px-4 py-1.5">
              <svg className="w-4 h-4 text-white/35 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onClick={() => setIsExpanded(true)}
                onBlur={() => setIsExpanded(false)}
                placeholder="Search or type a URL"
                className={`flex-1 bg-transparent text-white placeholder-white/35 focus:outline-none ${isExpanded ? 'text-sm' : 'text-sm'}`}
              />
            </div>
          </form>
          <button
            onClick={() => navigate(`/search-engine?url=${encodeURIComponent(MOVIES_URL)}`)}
            className="px-3.5 py-1.5 rounded-full text-xs font-semibold text-white"
            style={{ background: 'linear-gradient(135deg, #ef4444, #b91c1c)' }}
          >
            Movies
          </button>
          {targetUrl && (
            <button onClick={handleFullscreen} className="hidden sm:inline px-3 py-1.5 rounded-full text-xs text-white/70 hover:bg-white/10">Fullscreen</button>
          )}
          <button onClick={() => navigate('/homework#help')} className="hidden md:inline px-3 py-1.5 rounded-full text-xs text-white/70 hover:bg-white/10">Games</button>
          <button onClick={() => setShowSettingsModal(true)} className="hidden md:inline px-3 py-1.5 rounded-full text-xs text-white/70 hover:bg-white/10">Settings</button>
          <BatteryIndicator />
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 px-3 sm:px-4 pt-3 pb-3 min-h-0">
            {targetUrl && (
              <div className="w-full h-full bg-white/5 rounded-xl border border-white/10 backdrop-blur-md overflow-hidden relative">
                {isLoading && !skipLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-gray-300 text-sm">Loading proxy...</p>
                    </div>
                  </div>
                )}
                {hasError && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm z-10">
                    <div className="flex flex-col items-center gap-3 text-center px-4">
                      <div className="text-red-400 text-4xl">⚠️</div>
                      <p className="text-red-300 text-sm font-medium">Failed to load content</p>
                      <p className="text-gray-400 text-xs">Could not load this page through the proxy</p>
                      <button 
                        onClick={handleRefresh}
                        className="px-4 py-2 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 border border-blue-500/30 transition-all text-sm"
                      >
                        Try Again
                      </button>
                    </div>
                  </div>
                )}
                {!useSandbox && proxySrc && (
                <iframe 
                  key={'uv-' + iframeKey}
                  ref={iframeRef}
                  src={proxySrc}
                  className="w-full h-full border-0"
                  title="Ultraviolet Proxy"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation allow-downloads allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share; xr-spatial-tracking; usb; serial; magnetometer"
                  loading="eager"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
                )}
                {useSandbox && sandboxSrc && (
                <iframe 
                  key={'sandbox-' + iframeKey}
                  ref={sandboxRef}
                  src={sandboxSrc}
                  className={'w-full h-full border-0' + (!useSandbox && proxySrc ? ' hidden' : '')}
                  title="Sandbox Proxy"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-pointer-lock allow-presentation allow-downloads allow-top-navigation-by-user-activation allow-storage-access-by-user-activation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="accelerometer; autoplay; camera; clipboard-read; clipboard-write; encrypted-media; fullscreen; geolocation; gyroscope; microphone; midi; payment; picture-in-picture; screen-wake-lock; web-share; xr-spatial-tracking; usb; serial; magnetometer"
                  loading="eager"
                  onLoad={handleIframeLoad}
                  onError={handleIframeError}
                />
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {showSuggestionsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full mx-4 backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <p className="text-gray-300 mb-4 text-center text-sm">
              Submit your suggestions for either: website improvements, what games to add, what features to add onto the website.
            </p>
            <form onSubmit={handleSuggestionSubmit}>
              <textarea
                value={suggestionText}
                onChange={(e) => setSuggestionText(e.target.value)}
                placeholder="Enter your suggestion..."
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md mb-4 min-h-[120px] resize-none"
              />
              <div className="flex gap-3 justify-center">
                <button
                  type="button"
                  onClick={() => {
                    setShowSuggestionsModal(false);
                    setSuggestionText('');
                  }}
                  className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium"
                >
                  Submit your suggestion
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSitesModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0b0b10]/95 border border-white/10 rounded-3xl p-7 max-w-2xl w-full backdrop-blur-md shadow-2xl max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-white">My Sites</h2>
                <p className="text-xs text-gray-400 mt-1">Your own hosted pages. Open them right here in the browser area.</p>
              </div>
              <button
                onClick={() => setShowSitesModal(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            {sitesNotice && (
              <div className="mb-4 px-4 py-2.5 rounded-xl bg-purple-600/15 border border-purple-500/25 text-purple-200 text-sm">
                {sitesNotice}
              </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 mb-5">
              <p className="text-sm font-medium text-white/90 mb-3">Create or update a site</p>
              <input
                type="text"
                value={newSiteName}
                onChange={(e) => setNewSiteName(e.target.value)}
                placeholder="site name (e.g. my-page)"
                className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3 transition-all"
              />
              <textarea
                value={newSiteHtml}
                onChange={(e) => setNewSiteHtml(e.target.value)}
                placeholder="<h1>Hello world</h1>"
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 mb-3 min-h-[110px] resize-none font-mono transition-all"
              />
              <button
                onClick={saveSite}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-sm font-semibold transition-all"
              >
                Save &amp; Open
              </button>
            </div>

            <div>
              <p className="text-sm font-medium text-white/90 mb-3">Saved sites</p>
              {sites.length === 0 ? (
                <p className="text-gray-500 text-sm py-4 text-center">No sites yet. Create your first one above.</p>
              ) : (
                <div className="space-y-2">
                  {sites.map((site) => (
                    <div key={site.name} className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium truncate">{site.name}</p>
                        <p className="text-[11px] text-gray-500">by {site.owner} - {new Date(site.updated_at).toLocaleString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => {
                            setShowSitesModal(false);
                            navigate(`/search-engine?url=${encodeURIComponent(`${window.location.origin}/site/${site.name}`)}`);
                          }}
                          className="px-4 py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-200 border border-purple-500/30 text-xs font-medium transition-all"
                        >
                          Open
                        </button>
                        <button
                          onClick={() => deleteSite(site.name)}
                          className="px-4 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 text-xs font-medium transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <p className="text-[11px] text-gray-500 mt-5 text-center">Tip: type <span className="text-gray-300 font-mono">site:name</span> in the address bar, or keywords like <span className="text-gray-300 font-mono">games</span>, <span className="text-gray-300 font-mono">ai</span>, <span className="text-gray-300 font-mono">status</span> to jump inside Bat Prox.</p>
          </div>
        </div>
      )}

      <Settings
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />
    </div>
  );
}
