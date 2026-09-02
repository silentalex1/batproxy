import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import SubNavbar from './SubNavbar';
import { AmbientBg, SideRail } from './Chrome';

interface Changelog {
  id: number;
  version: string;
  title: string;
  description: string;
  created_at: string;
}

export default function Changelog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [changelogs, setChangelogs] = useState<Changelog[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showPost, setShowPost] = useState(false);
  const [version, setVersion] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postError, setPostError] = useState('');

  const hashVersion = location.hash.replace('#', '');
  const active = changelogs.find(c => c.version === hashVersion) || null;

  useEffect(() => {
    document.title = 'Website Changelogs';
    const load = async () => {
      try {
        const response = await fetch('/api/changelogs');
        const data = await response.json();
        setChangelogs(data.changelogs || []);
      } catch {
      }
      setLoading(false);
    };
    load();
    const interval = setInterval(load, 30000);
    const check = async () => {
      const token = localStorage.getItem('batprox-token');
      if (!token) return;
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
    };
    check();
    return () => clearInterval(interval);
  }, []);

  const deleteChangelog = async (id: number) => {
    try {
      const response = await fetch(`/api/changelogs/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('batprox-token') || ''}` }
      });
      if (response.ok) {
        setChangelogs(prev => prev.filter(c => c.id !== id));
        if (active?.id === id) navigate('/changelog');
      }
    } catch {
    }
  };

  const postChangelog = async (e: React.FormEvent) => {
    e.preventDefault();
    setPostError('');
    try {
      const response = await fetch('/api/changelogs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('batprox-token') || ''}`
        },
        body: JSON.stringify({ version, title, description })
      });
      const data = await response.json();
      if (response.ok) {
        setChangelogs(prev => [{
          id: data.id,
          version: version.trim(),
          title: title.trim(),
          description: description.trim(),
          created_at: new Date().toISOString()
        }, ...prev]);
        setShowPost(false);
        setVersion('');
        setTitle('');
        setDescription('');
      } else {
        setPostError(data.error || 'Failed to post changelog');
      }
    } catch {
      setPostError('Network error while posting changelog');
    }
  };

  const latest = changelogs[0];
  const nextVersion = active
    ? (changelogs[changelogs.indexOf(active) - 1]?.version || null)
    : (latest?.version || null);

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      <AmbientBg />
      <SideRail />

      <div className="relative z-10 flex flex-col min-h-screen">
        <SubNavbar />

        <main className="flex-1 flex flex-col items-center px-4 pb-16">
          <h1 className="text-3xl font-extrabold tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mt-4 mb-2 drop-shadow-lg">
            Website Changelogs
          </h1>
          <p className="text-gray-500 text-sm mb-8">Everything that changes on Bat Prox, newest first</p>

          <div className="flex items-center gap-3 mb-8">
            {nextVersion && (
              <button
                onClick={() => navigate(`/changelog#${nextVersion}`)}
                className="px-5 py-2.5 rounded-xl bg-purple-600/25 hover:bg-purple-600/45 text-purple-200 border border-purple-500/35 transition-all text-sm font-medium shadow-lg"
              >
                next changelog &lt;{nextVersion}&gt;
              </button>
            )}
            {active && (
              <>
                <button
                  onClick={() => navigate('/changelog')}
                  className="px-5 py-2.5 rounded-xl bg-white/8 hover:bg-white/15 text-white border border-white/15 transition-all text-sm font-medium shadow-lg"
                >
                  go back
                </button>
                <span className="px-5 py-2.5 rounded-xl bg-purple-600/15 text-purple-300 border border-purple-500/30 text-sm font-bold tracking-wide">
                  &lt;{active.version}&gt;
                </span>
              </>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowPost(true)}
                className="px-5 py-2.5 rounded-xl bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30 transition-all text-sm font-medium shadow-lg"
              >
                + post changelog
              </button>
            )}
          </div>

          <div className="w-full max-w-2xl">
            {loading ? (
              <div className="text-gray-500 text-center py-10 text-sm">Loading changelogs...</div>
            ) : changelogs.length === 0 ? (
              <div className="bg-black/40 border border-white/10 rounded-2xl p-10 text-center">
                <p className="text-gray-400 text-sm">No changelogs posted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {changelogs.map((log) => (
                  <div
                    key={log.id}
                    id={log.version}
                    className={`rounded-2xl border p-6 transition-all ${
                      active?.id === log.id
                        ? 'bg-purple-600/10 border-purple-500/40 shadow-[0_0_40px_rgba(147,51,234,0.12)]'
                        : 'bg-black/40 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <span className="text-[11px] font-bold tracking-widest px-2.5 py-1 rounded-full bg-purple-600/20 text-purple-300 border border-purple-500/30">
                        v{log.version}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] text-gray-500">{new Date(log.created_at).toLocaleDateString()}</span>
                        {isAdmin && (
                          <button
                            onClick={() => deleteChangelog(log.id)}
                            className="text-[11px] px-2.5 py-1 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all font-medium"
                          >
                            delete
                          </button>
                        )}
                      </div>
                    </div>
                    <h2 className="text-base font-semibold text-white mb-2">{log.title}</h2>
                    <p className="text-sm text-gray-400 leading-relaxed whitespace-pre-wrap">{log.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {showPost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={postChangelog} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-5">Post a new changelog</h3>
            <label className="block text-xs text-white/50 mb-1.5">enter changelog name title:</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all mb-4"
            />
            <label className="block text-xs text-white/50 mb-1.5">enter changelog description (what has been changed)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all mb-4 min-h-[100px] resize-none"
            />
            <label className="block text-xs text-white/50 mb-1.5">enter changelog version.</label>
            <input
              type="text"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
              placeholder="e.g. 1.1"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-purple-500/60 transition-all mb-4"
            />
            {postError && <p className="text-red-400 text-xs mb-3">{postError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowPost(false)}
                className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
              >
                + post changelog
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
