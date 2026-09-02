import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Feedback {
  id: number;
  content: string;
  user_identifier: string | null;
  submitted_at: string;
  status: string;
  genre?: string;
}

interface UserAccount {
  id: number;
  username: string;
  invite_code: string;
  created_at: string;
}

export default function AdminPanel() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [tab, setTab] = useState<'feedbacks' | 'accounts' | 'status'>('feedbacks');
  const [statusOverrides, setStatusOverrides] = useState<Record<string, string>>({});
  const SERVICES = ['Website API', 'Search Proxy', 'Wisp Transport', 'AI Service', 'Games Service', 'Database'];
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newCode, setNewCode] = useState('');
  const [createError, setCreateError] = useState('');
  const [revokeTarget, setRevokeTarget] = useState<UserAccount | null>(null);
  const [revokeCode, setRevokeCode] = useState('');
  const [revokeError, setRevokeError] = useState('');

  const getToken = () => localStorage.getItem('batprox-token') || '';

  const loadFeedbacks = async () => {
    try {
      const response = await fetch('/api/admin/feedbacks', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (response.ok) {
        setFeedbacks(data.feedbacks || []);
      } else {
        setError(data.error || 'Failed to load feedbacks');
      }
    } catch {
      setError('Network error while loading feedbacks');
    }
  };

  const loadUsers = async () => {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${getToken()}` }
      });
      const data = await response.json();
      if (response.ok) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch {
      setError('Network error while loading users');
    }
  };

  useEffect(() => {
    const token = getToken();
    setLoggedIn(!!token);
    const check = async () => {
      if (!token) {
        setIsAuthed(false);
        return;
      }
      try {
        const response = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          setIsAuthed(false);
          return;
        }
        const data = await response.json();
        setIsAuthed(!!data.isAdmin);
      } catch {
        setIsAuthed(false);
      }
    };
    check();
  }, []);

  const loadStatusOverrides = async () => {
    try {
      const response = await fetch('/api/status-overrides', { cache: 'no-store' });
      const data = await response.json();
      const map: Record<string, string> = {};
      (data.overrides || []).forEach((o: { name: string; color: string }) => {
        map[o.name] = o.color;
      });
      setStatusOverrides(map);
    } catch {
    }
  };

  const saveStatus = async (name: string, color: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/status', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ name, color })
      });
      const data = await response.json();
      if (response.ok) {
        setStatusOverrides(prev => {
          const next = { ...prev };
          if (color === 'auto') delete next[name];
          else next[name] = color;
          return next;
        });
        try {
          localStorage.setItem('bp-status-bump', String(Date.now()));
          const ch = new BroadcastChannel('batprox-status');
          ch.postMessage({ type: 'status-updated', name, color });
          ch.close();
        } catch {
        }
        setMessage(`Status for ${name} set to ${color}`);
        setTimeout(() => setMessage(''), 2000);
      } else {
        setError(data.error || 'Failed to save status');
      }
    } catch {
      setError('Network error while saving status');
    }
  };

  useEffect(() => {
    if (isAuthed && tab === 'feedbacks') loadFeedbacks();
    if (isAuthed && tab === 'accounts') loadUsers();
    if (isAuthed && tab === 'status') loadStatusOverrides();
  }, [isAuthed, tab]);

  useEffect(() => {
    let channel: BroadcastChannel | null = null;
    try {
      channel = new BroadcastChannel('batprox-status');
      channel.onmessage = () => loadStatusOverrides();
    } catch {
    }
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'bp-status-bump') loadStatusOverrides();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      channel?.close();
    };
  }, []);

  const handleDecline = async (suggestionId: number) => {
    setError('');
    try {
      const response = await fetch('/api/admin/decline-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ suggestionId })
      });
      if (response.ok) {
        setFeedbacks(prev => prev.filter(f => f.id !== suggestionId));
        setMessage('Feedback declined');
        setTimeout(() => setMessage(''), 2000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to decline suggestion');
      }
    } catch {
      setError('Network error while declining suggestion');
    }
  };

  const handleApprove = async (suggestionId: number) => {
    setError('');
    try {
      const response = await fetch('/api/admin/approve-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ suggestionId })
      });
      if (response.ok) {
        setFeedbacks(prev => prev.filter(f => f.id !== suggestionId));
        setMessage('Feedback approved');
        setTimeout(() => setMessage(''), 2000);
      } else {
        const errData = await response.json();
        setError(errData.error || 'Failed to approve suggestion');
      }
    } catch {
      setError('Network error while approving suggestion');
    }
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ username: newUsername, inviteCode: newCode })
      });
      const data = await response.json();
      if (response.ok) {
        setShowCreateModal(false);
        setNewUsername('');
        setNewCode('');
        setMessage('Account created');
        setTimeout(() => setMessage(''), 2000);
        loadUsers();
      } else {
        setCreateError(data.error || 'Failed to create account');
      }
    } catch {
      setCreateError('Network error while creating account');
    }
  };

  const handleRemoveUser = async (username: string) => {
    setError('');
    try {
      const response = await fetch('/api/admin/remove-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ username })
      });
      let data: { error?: string; message?: string } = {};
      try {
        data = await response.json();
      } catch {
        data = { error: `Request failed (${response.status}). Slow down and try again.` };
      }
      if (response.ok) {
        setUsers(prev => prev.filter(u => u.username !== username));
        setMessage(`Account "${username}" removed`);
        setTimeout(() => setMessage(''), 2000);
      } else {
        setError(data.error || 'Failed to remove account');
      }
    } catch {
      setError('Network error while removing account');
    }
  };

  const handleRevokeKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revokeTarget) return;
    setRevokeError('');
    try {
      const response = await fetch('/api/admin/revoke-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getToken()}`
        },
        body: JSON.stringify({ username: revokeTarget.username, newCode: revokeCode })
      });
      const data = await response.json();
      if (response.ok) {
        setMessage(`Access key revoked for "${revokeTarget.username}"`);
        setRevokeTarget(null);
        setRevokeCode('');
        setTimeout(() => setMessage(''), 2000);
        loadUsers();
      } else {
        setRevokeError(data.error || 'Failed to revoke access key');
      }
    } catch {
      setRevokeError('Network error while revoking access key');
    }
  };

  const logout = () => {
    localStorage.removeItem('batprox-token');
    localStorage.removeItem('batprox-user');
    navigate('/');
  };

  const background = (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0 bg-repeat opacity-60"
        style={{
          backgroundImage: `radial-gradient(1px 1px at 20px 30px, #fff, rgba(0,0,0,0)),
                            radial-gradient(1.5px 1.5px at 40px 70px, #fff, rgba(0,0,0,0)),
                            radial-gradient(1px 1px at 90px 40px, #fff, rgba(0,0,0,0)),
                            radial-gradient(2px 2px at 160px 120px, #ddd, rgba(0,0,0,0)),
                            radial-gradient(1.5px 1.5px at 230px 190px, #fff, rgba(0,0,0,0)),
                            radial-gradient(1px 1px at 300px 80px, #fff, rgba(0,0,0,0))`,
          backgroundSize: '350px 350px'
        }}
      />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
    </div>
  );

  if (isAuthed === null) {
    return (
      <div className="relative min-h-screen w-full bg-black text-white flex items-center justify-center">
        {background}
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthed) {
    return (
      <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
        {background}
        <main className="relative z-10 flex items-center justify-center min-h-screen px-4">
          <div className="bg-black/60 border border-white/10 rounded-2xl p-8 max-w-md w-full backdrop-blur-md shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-600/15 border border-red-500/30 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white mb-2">Admin access required</h1>
            <p className="text-gray-400 text-sm mb-6">This account does not have admin privileges. Log in with an admin account to continue.</p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate(loggedIn ? '/dashboard' : '/')}
                className="px-6 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all text-sm font-medium"
              >
                {loggedIn ? 'Dashboard' : 'Login page'}
              </button>
              <button
                onClick={logout}
                className="px-6 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 border border-purple-500/30 transition-all text-sm font-medium"
              >
                Switch account
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const pendingFeedbacks = feedbacks.filter(f => f.status === 'pending');
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(userSearch.toLowerCase()));

  return (
    <div className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white">
      {background}
      <main className="relative z-10 flex min-h-screen">
        <div className="w-60 shrink-0 bg-black/50 border-r border-white/10 backdrop-blur-md p-4 flex flex-col">
          <div className="flex items-center gap-2.5 mb-8 px-1">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center">
              <svg className="w-4 h-4 text-purple-300" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-white leading-tight">Admin Panel</h2>
              <p className="text-[10px] text-white/30">nightbat control</p>
            </div>
          </div>

          <nav className="space-y-1">
            <button
              onClick={() => setTab('feedbacks')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                tab === 'feedbacks' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              Feedback Suggestions
              {pendingFeedbacks.length > 0 && (
                <span className="ml-auto text-[10px] bg-purple-600/40 text-purple-200 px-1.5 py-0.5 rounded-full">{pendingFeedbacks.length}</span>
              )}
            </button>
            <button
              onClick={() => setTab('accounts')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                tab === 'accounts' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1.13a4 4 0 10-4-4 4 4 0 004 4zm6-4a3 3 0 11-3-3" />
              </svg>
              Create user accounts
            </button>
            <button
              onClick={() => setTab('status')}
              className={`w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium transition-colors flex items-center gap-2.5 ${
                tab === 'status' ? 'bg-white/[0.07] text-white' : 'text-white/45 hover:text-white/85 hover:bg-white/[0.03]'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Status change
            </button>
          </nav>

          <div className="mt-auto space-y-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
            >
              Back to Dashboard
            </button>
            <button
              onClick={logout}
              className="w-full px-3.5 py-2.5 rounded-lg text-left text-[13px] font-medium text-red-400/80 hover:text-red-300 hover:bg-red-600/10 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>

        <div className="flex-1 p-8 overflow-y-auto">
          <div className="max-w-4xl mx-auto">
            {message && (
              <div className="mb-5 text-xs text-green-400 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full inline-flex items-center gap-1.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {message}
              </div>
            )}
            {error && (
              <div className="mb-5 text-xs text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full inline-block">
                {error}
              </div>
            )}

            {tab === 'feedbacks' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-5">Users Feedback Suggestions</h2>
                <div className="space-y-3">
                  {pendingFeedbacks.length === 0 ? (
                    <div className="bg-black/40 border border-white/10 rounded-xl p-10 text-center">
                      <p className="text-gray-400 text-sm">No pending feedback suggestions.</p>
                      <p className="text-gray-600 text-xs mt-1">New suggestions will appear here for approval.</p>
                    </div>
                  ) : (
                    pendingFeedbacks.map((feedback) => (
                      <div key={feedback.id} className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md hover:border-white/20 transition-colors">
                        <div className="flex justify-between items-start gap-4">
                          <div className="min-w-0">
                            <p className="text-xs text-gray-500 mb-1.5">
                              feedback from <span className="text-purple-300 font-medium">{feedback.user_identifier || 'unknown'}</span>
                              <span className="text-gray-600"> · {new Date(feedback.submitted_at).toLocaleString()}</span>
                              <span className={`ml-2 text-[10px] px-2 py-0.5 rounded-full border align-middle ${feedback.genre === 'Website bug' ? 'text-red-300 border-red-500/25 bg-red-500/10' : 'text-blue-300 border-blue-500/25 bg-blue-500/10'}`}>
                                {feedback.genre || 'Feedback suggestions'}
                              </span>
                            </p>
                            <p className="text-gray-200 text-sm break-words">{feedback.content}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => handleDecline(feedback.id)}
                              className="text-xs px-4 py-2 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all font-medium"
                            >
                              Decline
                            </button>
                            <button
                              onClick={() => handleApprove(feedback.id)}
                              className="text-xs px-4 py-2 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-300 border border-green-500/30 transition-all font-medium"
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {tab === 'accounts' && (
              <div>
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-lg font-bold text-white">Create user accounts</h2>
                  <button
                    onClick={() => { setShowCreateModal(true); setCreateError(''); }}
                    className="text-xs px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-medium transition-all flex items-center gap-1.5"
                  >
                    <span className="text-base leading-none">+</span> create account
                  </button>
                </div>

                <div className="bg-black/40 border border-white/10 rounded-xl p-5 backdrop-blur-md">
                  <p className="text-white font-semibold text-sm mb-3">validated users</p>
                  <div className="relative mb-4">
                    <svg className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search for users..."
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50 transition-all"
                    />
                  </div>

                  {filteredUsers.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-6">No users found.</p>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((user) => (
                        <div key={user.id} className="flex items-center justify-between gap-4 bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 rounded-lg px-4 py-3 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm text-white font-medium truncate">{user.username}</p>
                            <p className="text-[11px] text-gray-500">code: <span className="text-gray-400">{user.invite_code}</span> · added {new Date(user.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex gap-2 shrink-0">
                            <button
                              onClick={() => { setRevokeTarget(user); setRevokeCode(''); setRevokeError(''); }}
                              className="text-xs px-3 py-1.5 rounded-lg bg-yellow-600/15 hover:bg-yellow-600/35 text-yellow-300 border border-yellow-500/25 transition-all"
                            >
                              revoke access key
                            </button>
                            <button
                              onClick={() => handleRemoveUser(user.username)}
                              className="text-xs px-3 py-1.5 rounded-lg bg-red-600/15 hover:bg-red-600/35 text-red-300 border border-red-500/25 transition-all"
                            >
                              remove account
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {tab === 'status' && (
              <div>
                <h2 className="text-lg font-bold text-white mb-1">Status change</h2>
                <p className="text-gray-500 text-sm mb-5">Manually set how each service shows on the API Status page. Green = available, purple = fixing, red = down, auto = real check.</p>
                <div className="space-y-3">
                  {SERVICES.map((service) => {
                    const current = statusOverrides[service] || 'auto';
                    const options = [
                      { id: 'green', label: 'Green', dot: 'bg-green-400' },
                      { id: 'purple', label: 'Purple', dot: 'bg-purple-400' },
                      { id: 'red', label: 'Red', dot: 'bg-red-400' },
                      { id: 'auto', label: 'Auto', dot: 'bg-white/40' }
                    ];
                    return (
                      <div key={service} className="bg-black/40 border border-white/10 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className={`w-2.5 h-2.5 rounded-full ${options.find(o => o.id === current)?.dot}`} />
                          <span className="text-sm font-medium text-white/90">{service}</span>
                          <span className="text-[11px] text-gray-500 uppercase tracking-wide">{current}</span>
                        </div>
                        <div className="flex gap-2">
                          {options.map((o) => (
                            <button
                              key={o.id}
                              onClick={() => saveStatus(service, o.id)}
                              className={`text-xs px-3.5 py-1.5 rounded-lg border transition-all font-medium flex items-center gap-1.5 ${
                                current === o.id
                                  ? 'bg-white/[0.1] text-white border-white/25'
                                  : 'bg-white/[0.03] text-white/55 border-white/10 hover:bg-white/[0.07] hover:text-white'
                              }`}
                            >
                              <span className={`w-2 h-2 rounded-full ${o.dot}`} />
                              {o.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleCreateAccount} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-5">Create user account</h3>
            <label className="block text-xs text-white/50 mb-1.5">enter account username for the person</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="username"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-4"
            />
            <label className="block text-xs text-white/50 mb-1.5">enter account invite code</label>
            <input
              type="text"
              value={newCode}
              onChange={(e) => setNewCode(e.target.value)}
              placeholder="invite code"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-4"
            />
            {createError && <p className="text-red-400 text-xs mb-3">{createError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition-all"
              >
                + create account
              </button>
            </div>
          </form>
        </div>
      )}

      {revokeTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <form onSubmit={handleRevokeKey} className="bg-[#0d0d12] border border-white/10 rounded-2xl p-7 max-w-md w-full shadow-2xl">
            <h3 className="text-base font-semibold text-white mb-5">enter a new access invite key for the <span className="text-purple-300">{revokeTarget.username}</span></h3>
            <input
              type="text"
              value={revokeCode}
              onChange={(e) => setRevokeCode(e.target.value)}
              placeholder="new invite code"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500/60 transition-all mb-4"
            />
            {revokeError && <p className="text-red-400 text-xs mb-3">{revokeError}</p>}
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setRevokeTarget(null)}
                className="px-5 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-black text-sm font-semibold transition-all"
              >
                Revoke key
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
