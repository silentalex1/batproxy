import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import SearchEngine from './SearchEngine';
import AdminPanel from './AdminPanel';
import MoreGames from './MoreGames';
import AIWork from './AIWork';
import Settings from './Settings';
import Login from './Login';
import { launchAboutBlankCloak, isAboutBlankTabEnabled } from './cloak';
import Changelog from './Changelog';
import BatStatus from './BatStatus';
import ApiDocs from './ApiDocs';
import Chatting from './Chatting';
import AutoLogout from './AutoLogout';
import PageChrome from './PageChrome';
import { AmbientBg, SideRail, DashNav, RotatingTagline } from './Chrome';
import { buildSearchUrl, MOVIES_URL } from './engines';
import { initUltraviolet } from './uv';

function Dashboard() {
  const navigate = useNavigate();
  const [clock, setClock] = useState({ hms: '', ampm: '', date: '' });
  const [url, setUrl] = useState<string>('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSuggestionsModal, setShowSuggestionsModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionGenre, setSuggestionGenre] = useState('Feedback suggestions');
  const [username, setUsername] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [approvedFeedback, setApprovedFeedback] = useState<{ id: number; content: string; status: string } | null>(null);
  const [showThanks, setShowThanks] = useState(false);
  const [thanksFading, setThanksFading] = useState(false);

  useEffect(() => {
    document.title = "Bat Prox";
    setUsername(localStorage.getItem('batprox-user') || 'user');

    const verify = async () => {
      const token = localStorage.getItem('batprox-token');
      if (!token) {
        navigate('/');
        return;
      }
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const data = await response.json();
        if (!response.ok) {
          localStorage.removeItem('batprox-token');
          localStorage.removeItem('batprox-user');
          navigate('/');
        } else {
          setIsAdmin(!!data.isAdmin);
          if (isAboutBlankTabEnabled()) {
            launchAboutBlankCloak();
          }
        }
      } catch {
        navigate('/');
      }
    };
    verify();
    initUltraviolet().catch(() => {});

    const updateTimer = () => {
      const now = new Date();
      const hms = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
      const parts = hms.split(' ');
      setClock({
        hms: parts[0] || hms,
        ampm: parts[1] || '',
        date: now.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
      });
    };

    updateTimer();
    const intervalId = setInterval(updateTimer, 1000);

    let notificationTimeout: ReturnType<typeof setTimeout> | null = null;
        const checkNotifications = async () => {
      if (notificationTimeout) {
        clearTimeout(notificationTimeout);
      }

      notificationTimeout = setTimeout(async () => {
        if (!username) return;
        try {
          const response = await fetch(`/api/suggestions/${encodeURIComponent(username)}`);

          if (response.status === 429) {
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
              console.log(`Rate limited. Retry after ${retryAfter} seconds`);
              return;
            }
          }

          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.log('Non-JSON response from notifications API:', contentType);
            return;
          }

          const data = await response.json();

          if (data.notifications && data.notifications.length > 0) {
            let dismissed: number[] = [];
            try {
              dismissed = JSON.parse(localStorage.getItem('batprox-dismissed-feedback') || '[]');
            } catch {
              dismissed = [];
            }
            const fresh = data.notifications.find((n: { id: number }) => !dismissed.includes(n.id));
            if (fresh) {
              dismissed.push(fresh.id);
              localStorage.setItem('batprox-dismissed-feedback', JSON.stringify(dismissed));
              setApprovedFeedback({ id: fresh.id, content: fresh.content, status: fresh.status });
            }
          }
        } catch {
          return;
        }
      }, 300);
    };

    const notificationInterval = setInterval(checkNotifications, 3000);

    return () => {
      clearInterval(intervalId);
      clearInterval(notificationInterval);
    };
  },
 [username, navigate]);


  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      navigate(`/search-engine?url=${encodeURIComponent(buildSearchUrl(url))}`);
    }
  };

  const handleButtonClick = (label: string) => {
    let targetUrl = '';
    switch (label) {
      case 'Youtube':
        targetUrl = 'https://youtube.com';
        break;
      case 'Discord':
        targetUrl = 'https://discord.com';
        break;
      case 'Roblox':
        targetUrl = 'https://roblox.com';
        break;
      case 'Spotify':
        targetUrl = 'https://open.spotify.com';
        break;
      case 'Pinterest':
        targetUrl = 'https://pinterest.com';
        break;
      case 'Music':
        targetUrl = 'https://music.octavestreaming.com/';
        break;
      case 'Movies':
        targetUrl = MOVIES_URL;
        break;
      case 'AI':
        navigate('/ai-work');
        return;
      default:
        return;
    }
    navigate(`/search-engine?url=${encodeURIComponent(targetUrl)}`);
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
          body: JSON.stringify({ content: suggestionText, userIdentifier: username || 'anonymous', genre: suggestionGenre }),
        });

        if (response.ok) {
          const data = await response.json();
          console.log('Suggestion submitted:', data);
          setShowSuggestionsModal(false);
          setSuggestionText('');
          setShowThanks(true);
          setThanksFading(false);
          setTimeout(() => setThanksFading(true), 3200);
          setTimeout(() => setShowThanks(false), 3800);
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

  const proxyLinks = [
    { label: 'Youtube', image: '/assets/youtube.png', tint: 'bg-[#ff0000]' },
    { label: 'Discord', image: '/assets/discord.png', tint: 'bg-[#5865F2]' },
    { label: 'Roblox', image: '/assets/robloxcom.png', tint: 'bg-[#1a1a1a]' },
    { label: 'Spotify', image: '/assets/spotify.png', tint: 'bg-[#1DB954]' },
    { label: 'Pinterest', image: '/assets/pinterest.png', tint: 'bg-[#E60023]' },
    { label: 'Music', image: '/assets/musiclogo2.png', tint: 'bg-[#7c3aed]' },
    { label: 'Movies', image: null, tint: 'bg-[#ef4444]' },
    { label: 'AI', image: null, tint: 'bg-[#8b5cf6]' }
  ];

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail onSettings={() => setShowSettingsModal(true)} />

      <main className="relative z-10 flex flex-col items-center min-h-screen px-4 sm:pl-20 sm:pr-6">
        <DashNav
          username={username}
          isAdmin={isAdmin}
          onLogout={() => {
            localStorage.removeItem('batprox-token');
            localStorage.removeItem('batprox-user');
            navigate('/');
          }}
          onAdmin={() => navigate('/admin-panel')}
          onChangelogs={() => navigate('/changelog')}
          onStatus={() => navigate('/bat-status')}
          onSuggestions={() => setShowSuggestionsModal(true)}
          onSettings={() => setShowSettingsModal(true)}
        />

        <div className="flex-1 flex flex-col items-center justify-start w-full max-w-3xl pt-4 pb-16">
          <p className="text-[11px] tracking-[0.35em] uppercase text-white/35 mb-1">{clock.date}</p>
          <div className="flex items-end gap-2 mb-1">
            <h2 className="text-5xl sm:text-7xl font-semibold tracking-tight tabular-nums leading-none" style={{ textShadow: '0 0 28px rgba(var(--bp-glow), 0.35)' }}>
              {clock.hms}
            </h2>
            <span className="text-lg sm:text-2xl font-medium text-white/35 mb-1">{clock.ampm}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight mb-2" style={{ color: 'var(--bp-accent)' }}>
            Bat Prox
          </h1>
          <RotatingTagline
            lines={[
              'Website took 3 weeks to make.',
              'Website was only made by an 18 yr old.',
              'school sucks'
            ]}
          />

          <form onSubmit={handleSearch} className="w-full max-w-xl relative mb-9">
            <svg className="w-5 h-5 text-white/35 absolute left-5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onClick={() => setIsExpanded(true)}
              onBlur={() => setIsExpanded(false)}
              placeholder="Search anything..."
              className={`w-full pl-12 pr-24 rounded-full bg-white/[0.06] border border-white/10 text-white placeholder-white/35 focus:outline-none focus:border-[var(--bp-accent)] transition-all backdrop-blur-md text-left shadow-2xl text-sm sm:text-base ${
                isExpanded ? 'py-5 text-base sm:text-lg' : 'py-3.5 sm:py-4'
              }`}
            />
            <button
              type="submit"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-5 py-2 rounded-full text-white text-sm font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, var(--bp-accent), var(--bp-accent-2))' }}
            >
              Go
            </button>
          </form>

          <div className="flex flex-wrap justify-center gap-4 w-full mb-10">
            {proxyLinks.map((item) => (
              <button
                key={item.label}
                onClick={() => handleButtonClick(item.label)}
                className="group flex flex-col items-center gap-2 min-w-[72px]"
              >
                <span className={`w-14 h-14 rounded-2xl ${item.tint} flex items-center justify-center overflow-hidden shadow-lg shadow-black/40 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5`}>
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.label}
                      className="w-8 h-8 object-contain"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  ) : item.label === 'Movies' ? (
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path strokeLinecap="round" d="M7 5v14M17 5v14M3 9h18M3 15h18" />
                    </svg>
                  ) : (
                    <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                  )}
                </span>
                <span className="text-[11px] text-white/70 group-hover:text-white">{item.label}</span>
              </button>
            ))}
          </div>

          <a
            href="https://discord.gg/QreCHyeSpj"
            className="px-5 py-2 rounded-full bg-white/[0.05] text-white/80 border border-white/10 hover:bg-white/10 hover:text-white transition-all backdrop-blur-sm text-sm"
          >
            Join the Discord
          </a>
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
              <select
                value={suggestionGenre}
                onChange={(e) => setSuggestionGenre(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all backdrop-blur-md mb-3 cursor-pointer"
              >
                <option value="Feedback suggestions">Feedback suggestions</option>
                <option value="Website bug">Website bug</option>
              </select>
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

      {showThanks && (
        <div
          className={`fixed top-6 left-1/2 z-[60] px-6 py-3.5 rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-100 text-sm font-medium shadow-2xl backdrop-blur-md ${
            thanksFading ? 'animate-fade-down-out' : 'animate-fade-down'
          }`}
          style={{ transform: 'translateX(-50%)' }}
        >
          thank you for your feedback!
        </div>
      )}

      {approvedFeedback && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-[#0d0d12] border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl text-center">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 ${approvedFeedback.status === 'declined' ? 'bg-red-600/15 border border-red-500/30' : 'bg-green-600/15 border border-green-500/30'}`}>
              <svg className={`w-7 h-7 ${approvedFeedback.status === 'declined' ? 'text-red-400' : 'text-green-400'}`} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                {approvedFeedback.status === 'declined' ? (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                )}
              </svg>
            </div>
            {approvedFeedback.status === 'declined' ? (
              <h3 className="text-lg font-semibold text-white mb-2">your feedback suggestion has been declined.</h3>
            ) : (
              <h3 className="text-lg font-semibold text-white mb-2">your feedback has been approved.</h3>
            )}
            {approvedFeedback.status !== 'declined' && (
              <p className="text-sm text-gray-400 mb-6">however feedback may take a bit to be added so please be patient.</p>
            )}
            <button
              onClick={() => {
                let dismissed: number[] = [];
                try {
                  dismissed = JSON.parse(localStorage.getItem('batprox-dismissed-feedback') || '[]');
                } catch {
                  dismissed = [];
                }
                dismissed.push(approvedFeedback.id);
                localStorage.setItem('batprox-dismissed-feedback', JSON.stringify(dismissed));
                setApprovedFeedback(null);
              }}
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
            >
              Okay
            </button>
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

export default function App() {
  return (
    <Router>
      <AutoLogout />
      <PageChrome />
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/search-engine" element={<SearchEngine />} />
        <Route path="/admin-panel" element={<AdminPanel />} />
        <Route path="/homework" element={<MoreGames />} />
        <Route path="/ai-work" element={<AIWork />} />
        <Route path="/changelog" element={<Changelog />} />
        <Route path="/bat-status" element={<BatStatus />} />
        <Route path="/api-status/docs" element={<ApiDocs />} />
        <Route path="/chatting" element={<Chatting />} />
      </Routes>
    </Router>
  );
}
