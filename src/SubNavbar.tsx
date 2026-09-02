import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Settings from './Settings';
import { TopBar, NavBtn } from './Chrome';

interface SubNavbarProps {
  goBackLabel?: string;
  goBackTo?: string;
  showApiDoc?: boolean;
}

export default function SubNavbar({ goBackLabel = '< Go back', goBackTo = '/dashboard', showApiDoc = false }: SubNavbarProps) {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checked, setChecked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [userIdentifier] = useState(() => localStorage.getItem('batprox-user') || 'anonymous');
  const [notice, setNotice] = useState('');
  const [suggestionGenre, setSuggestionGenre] = useState('Feedback suggestions');

  useEffect(() => {
    const check = async () => {
      const token = localStorage.getItem('batprox-token');
      if (!token) {
        setChecked(true);
        return;
      }
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setIsAdmin(!!data.isAdmin);
        }
      } catch {
      }
      setChecked(true);
    };
    check();
  }, []);

  const submitSuggestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!suggestionText.trim()) return;
    try {
      await fetch('/api/suggestions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: suggestionText, userIdentifier, genre: suggestionGenre }),
      });
      setShowSuggestions(false);
      setSuggestionText('');
      setNotice('thank you for your feedback!');
      setTimeout(() => setNotice(''), 3500);
    } catch {
    }
  };

  return (
    <>
      {notice && (
        <div
          className="fixed top-6 left-1/2 z-[60] px-6 py-3.5 rounded-xl bg-purple-600/25 border border-purple-500/40 text-purple-100 text-sm font-medium shadow-2xl backdrop-blur-md animate-fade-down"
          style={{ transform: 'translateX(-50%)' }}
        >
          {notice}
        </div>
      )}
      <div className="sm:pl-16">
        <TopBar>
          <div className="flex items-center gap-3">
            {checked ? (
              isAdmin ? (
                <span className="inline-flex items-center h-6 text-[10px] font-bold tracking-widest px-2 rounded-md bg-emerald-950/80 text-emerald-300">ADMIN</span>
              ) : (
                <span className="w-2 h-2 rounded-full bg-sky-400/70" />
              )
            ) : (
              <span className="w-16 h-7 rounded-full bg-white/5 animate-pulse" />
            )}
            <NavBtn onClick={() => navigate(goBackTo)}>{goBackLabel}</NavBtn>
          </div>
          <div className="flex items-center gap-2">
            {showApiDoc && (
              <NavBtn onClick={() => navigate('/api-status/docs')}>API doc</NavBtn>
            )}
            <NavBtn onClick={() => setShowSuggestions(true)}>Suggestions</NavBtn>
            <NavBtn onClick={() => setShowSettings(true)}>Settings</NavBtn>
          </div>
        </TopBar>
      </div>

      {showSuggestions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <form onSubmit={submitSuggestion} className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-lg w-full backdrop-blur-md shadow-2xl">
            <h2 className="text-2xl font-bold text-white mb-6 text-center">Feedback</h2>
            <select
              value={suggestionGenre}
              onChange={(e) => setSuggestionGenre(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all mb-4 cursor-pointer"
            >
              <option value="Feedback suggestions">Feedback suggestions</option>
              <option value="Website bug">Website bug</option>
            </select>
            <textarea
              value={suggestionText}
              onChange={(e) => setSuggestionText(e.target.value)}
              placeholder="Enter your suggestion..."
              className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all mb-4 min-h-[120px] resize-none"
            />
            <div className="flex gap-3 justify-center">
              <button
                type="button"
                onClick={() => setShowSuggestions(false)}
                className="px-6 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
      )}

      <Settings isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </>
  );
}
