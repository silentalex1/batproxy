import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import Cookies from 'js-cookie';
import Settings from './Settings';

interface ChatHistory {
  id: string;
  title: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string; terminal?: string[] }>;
  timestamp: number;
  checkpoints?: Array<{ id: string; messageIndex: number; timestamp: number }>;
}

export default function AIWork() {
  const navigate = useNavigate();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string; terminal?: string[] }>>([]);
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; chatId: string } | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [typingContent, setTypingContent] = useState('');
  const [images, setImages] = useState<Array<{ id: string; data: string; file: File }>>([]);
  const [attachedFiles, setAttachedFiles] = useState<Array<{ id: string; file: File; label?: string }>>([]);
  const [dragging, setDragging] = useState(false);
    const dragCounterRef = useRef(0);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [stopTyping, setStopTyping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedContent, setPausedContent] = useState('');
  const typingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [checkpoints, setCheckpoints] = useState<Array<{ id: string; messageIndex: number; timestamp: number }>>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [expandedChats, setExpandedChats] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [disableTypingAnimation, setDisableTypingAnimation] = useState(false);
  
  useEffect(() => {
    const savedSettings = localStorage.getItem('batprox-settings');
    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setDisableTypingAnimation(settings.disableTypingAnimation || false);
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingContent]);

  useEffect(() => {
    const savedHistory = Cookies.get('chatHistory');
    if (savedHistory) {
      try {
        setChatHistory(JSON.parse(savedHistory));
      } catch (error) {
        console.error('Error parsing chat history from cookies:', error);
      }
    }
  }, []);

  useEffect(() => {
    Cookies.set('chatHistory', JSON.stringify(chatHistory), { expires: 365 });
  }, [chatHistory]);

  const saveChatToHistory = (messagesToSave?: Array<{ role: 'user' | 'assistant'; content: string }>) => {
    const messagesArray = messagesToSave || messages;
    if (messagesArray.length === 0) return;
    
    const title = messagesArray[0]?.content.substring(0, 30) + (messagesArray[0]?.content.length > 30 ? '...' : '') || 'New Chat';
    const newChat: ChatHistory = {
      id: currentChatId || Date.now().toString(),
      title,
      messages: messagesArray,
      timestamp: Date.now(),
      checkpoints
    };
    
    if (currentChatId) {
      setChatHistory(prev => {
        const updated = prev.map(chat => chat.id === currentChatId ? newChat : chat);
        Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 });
        return updated;
      });
    } else {
      setChatHistory(prev => {
        const updated = [newChat, ...prev];
        Cookies.set('chatHistory', JSON.stringify(updated), { expires: 365 });
        setCurrentChatId(newChat.id);
        return updated;
      });
    }
  };

  const loadChat = (chatId: string) => {
    const chat = chatHistory.find(c => c.id === chatId);
    if (chat) {
      setMessages(chat.messages);
      setCurrentChatId(chatId);
      setCheckpoints(chat.checkpoints || []);
    }
  };

  const startNewChat = () => {
    setMessages([]);
    setCurrentChatId(null);
    setCheckpoints([]);
  };

  const deleteChat = (chatId: string) => {
    setChatHistory(prev => {
      const newHistory = prev.filter(chat => chat.id !== chatId);
      Cookies.set('chatHistory', JSON.stringify(newHistory), { expires: 365 });
      return newHistory;
    });
    if (currentChatId === chatId) {
      startNewChat();
    }
    setContextMenu(null);
  };

  const handleContextMenu = (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chatId });
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
    
    imageItems.forEach(item => {
      const file = item.getAsFile();
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setImages(prev => [...prev, { id: Date.now().toString(), data: dataUrl, file }]);
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const addFiles = (files: Array<{ file: File; label?: string }>) => {
    files.forEach(({ file, label }) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const dataUrl = event.target?.result as string;
          setImages(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), data: dataUrl, file }]);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachedFiles(prev => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), file, label }]);
      }
    });
  };

  const readEntry = async (entry: any, folderLabel?: string): Promise<Array<{ file: File; label?: string }>> => {
    if (!entry) return [];
    if (entry.isFile) {
      return new Promise((resolve) => entry.file((f: File) => resolve([{ file: f, label: folderLabel || f.name }]), () => resolve([])));
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      const all: Array<{ file: File; label?: string }> = [];
      const readBatch = (): Promise<any[]> => new Promise((resolve) => reader.readEntries((entries: any[]) => resolve(entries), () => resolve([])));
      let batch = await readBatch();
      while (batch.length > 0) {
        for (const e of batch) {
          all.push(...(await readEntry(e, entry.name)));
        }
        batch = await readBatch();
      }
      return all;
    }
    return [];
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    if (message.trim() || images.length > 0) {
      const userMessage = message.trim();
      const newMessages = [...messages, { role: 'user' as const, content: userMessage }];
      setMessages(newMessages);
      setMessage('');
      setIsTyping(true);
      setTypingContent('');
      setStopTyping(false);
      setIsPaused(false);
      const currentImages = [...images];
      setImages([]);
      
      const newCheckpoint = {
        id: Date.now().toString(),
        messageIndex: newMessages.length - 1,
        timestamp: Date.now()
      };
      setCheckpoints(prev => [...prev, newCheckpoint]);

      try {
        const currentFiles = [...attachedFiles];
        const formData = new FormData();
        formData.append('message', userMessage);
        currentImages.forEach((img) => {
          formData.append('files', img.file);
        });
        currentFiles.forEach((f) => {
          formData.append('files', f.file);
        });
        setAttachedFiles([]);

        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errData = await response.json().catch(() => null);
          throw new Error(errData?.error || 'Failed to get AI response');
        }

        const data = await response.json();
        const aiResponse = data.response;
        const aiTerminal: string[] = data.terminal || [];

        if (disableTypingAnimation) {
          const finalMessages = [...messages, { role: 'assistant' as const, content: aiResponse, terminal: aiTerminal }];
          setMessages(finalMessages);
          setIsTyping(false);
          saveChatToHistory(finalMessages);
        } else {
          let index = 0;
          typingIntervalRef.current = setInterval(() => {
            if (stopTyping) {
              clearInterval(typingIntervalRef.current!);
              setIsTyping(false);
              setPausedContent(typingContent);
              setIsPaused(true);
              return;
            }
            
            if (index < aiResponse.length) {
              setTypingContent(aiResponse.substring(0, index + 1));
              index++;
            } else {
              clearInterval(typingIntervalRef.current!);
              setIsTyping(false);
              const finalMessages = [...messages, { role: 'assistant' as const, content: aiResponse, terminal: aiTerminal }];
              setMessages(finalMessages);
              setTypingContent('');
              setIsPaused(false);
              saveChatToHistory(finalMessages);
            }
          }, 15); }
      } catch (error) {
        console.error('Error sending message:', error);
        setIsTyping(false);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Please try again.'}`
        }]);
      }
    }
  };

  const handleStopTyping = () => {
    setStopTyping(true);
  };

  const handleContinueTyping = () => {
    setIsPaused(false);
    setStopTyping(false);
    setIsTyping(true);
    
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant') {
      const fullResponse = lastMessage.content;
      const startIndex = pausedContent.length;
      
      let index = startIndex;
      typingIntervalRef.current = setInterval(() => {
        if (stopTyping) {
          clearInterval(typingIntervalRef.current!);
          setIsTyping(false);
          setPausedContent(typingContent);
          setIsPaused(true);
          return;
        }
        
        if (index < fullResponse.length) {
          setTypingContent(fullResponse.substring(0, index + 1));
          index++;
        } else {
          clearInterval(typingIntervalRef.current!);
          setIsTyping(false);
          setTypingContent('');
          setIsPaused(false);
          saveChatToHistory(messages);
        }
      }, 15);
    }
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current++;
    setDragging(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setDragging(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    dragCounterRef.current = 0;
    const items = Array.from(e.dataTransfer.items || []);
    const entries = items.map((it) => (it.webkitGetAsEntry ? it.webkitGetAsEntry() : null));
    if (entries.some((en) => en)) {
      const collected: Array<{ file: File; label?: string }> = [];
      for (const en of entries) {
        collected.push(...(await readEntry(en)));
      }
      addFiles(collected);
    } else {
      addFiles(Array.from(e.dataTransfer.files || []).map((f) => ({ file: f, label: f.name })));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div
      className="relative min-h-screen w-full bg-black overflow-hidden font-sans text-white"
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={handleDrop}
    >
      {dragging && (
        <div className="fixed inset-0 z-[60] bg-purple-600/10 backdrop-blur-sm border-2 border-dashed border-purple-500/60 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <svg className="w-14 h-14 text-purple-300 mx-auto mb-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <p className="text-lg font-medium text-purple-200">drop your files here</p>
            <p className="text-xs text-purple-300/60 mt-1">images, folders and .zip archives are supported</p>
          </div>
        </div>
      )}
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
            backgroundSize: '350px 350px',
          }}
        />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 sm:w-96 sm:h-96 bg-purple-600/30 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-purple-400/20 rounded-full blur-[60px] pointer-events-none" />
      </div>

      <main className="relative z-10 flex flex-col min-h-screen">
        <div className="w-full flex justify-center py-4 relative z-30">
          <div className="flex gap-3 px-10 py-3 rounded-2xl bg-black/60 border border-white/20 backdrop-blur-2xl shadow-2xl w-full max-w-6xl mx-4 items-center">
            <div className="relative mr-auto">
              <button
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="px-5 py-2 rounded-xl bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 border border-purple-500/40 transition-all text-sm font-medium shadow-lg flex items-center gap-2"
              >
                <span>Chat History</span>
                <svg className={`w-4 h-4 transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-3 w-80 max-h-96 overflow-y-auto bg-[#0d0d12]/95 border border-white/10 rounded-2xl backdrop-blur-xl shadow-2xl z-50">
                  <div className="sticky top-0 bg-[#0d0d12]/95 backdrop-blur-xl p-3 border-b border-white/5">
                    <div className="flex items-center justify-between px-1 mb-2.5">
                      <p className="text-[11px] uppercase tracking-widest text-white/35 font-semibold">Chat history</p>
                      <span className="text-[11px] text-white/25">{chatHistory.length}</span>
                    </div>
                    <button
                      onClick={startNewChat}
                      className="w-full px-4 py-2.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/45 text-purple-200 border border-purple-500/30 transition-all text-sm font-medium"
                    >
                      + New Chat
                    </button>
                  </div>
                  <div className="p-3 space-y-2">
                    {chatHistory.length === 0 ? (
                      <div className="text-center text-gray-500 text-sm py-4">
                        No chat history
                      </div>
                    ) : (
                      chatHistory.map((chat) => (
                        <div key={chat.id}>
                          <div
                            onContextMenu={(e) => handleContextMenu(e, chat.id)}
                            onClick={() => {
                              loadChat(chat.id);
                              setExpandedChats(prev => {
                                const newSet = new Set(prev);
                                if (newSet.has(chat.id)) {
                                  newSet.delete(chat.id);
                                } else {
                                  newSet.add(chat.id);
                                }
                                return newSet;
                              });
                            }}
                            className={`group px-3.5 py-2.5 rounded-xl cursor-pointer transition-all text-sm truncate flex items-center gap-2 ${
                              currentChatId === chat.id
                                ? 'bg-purple-600/25 border border-purple-500/40 text-white'
                                : 'bg-white/[0.03] hover:bg-white/[0.08] text-gray-300 border border-transparent hover:border-white/15'
                            }`}
                          >
                            <span className="truncate flex-1">
                              {chat.title}
                              <span className="block text-[10px] text-white/25 mt-0.5">
                                {new Date(chat.timestamp).toLocaleDateString()} · {chat.messages.length} messages
                              </span>
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteChat(chat.id);
                              }}
                              className="shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-white/30 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
                              </svg>
                            </button>
                            <svg className={`w-4 h-4 shrink-0 text-white/30 transition-transform duration-300 ${expandedChats.has(chat.id) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                          {expandedChats.has(chat.id) && chat.checkpoints && chat.checkpoints.length > 0 && (
                            <div className="ml-4 mt-2 space-y-1 animate-in slide-in-from-top-2 duration-300">
                              {chat.checkpoints.map((checkpoint, index) => (
                                <div
                                  key={checkpoint.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadChat(chat.id);
                                    const checkpointsList = chat.checkpoints || [];
                                    setCheckpoints(checkpointsList);
                                    const messagesAtCheckpoint = chat.messages.slice(0, checkpoint.messageIndex + 1);
                                    setMessages(messagesAtCheckpoint);
                                    setCheckpoints(checkpointsList.slice(0, index + 1));
                                    setIsDropdownOpen(false);
                                  }}
                                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer hover:bg-blue-500/20 transition-all group"
                                >
                                  <div className="w-0.5 h-4 bg-blue-400 rounded-full" />
                                  <span className="text-xs text-blue-300 group-hover:text-blue-200">
                                    Checkpoint {index + 1}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2 rounded-xl bg-white/5 hover:bg-white/15 text-white border border-white/15 hover:border-purple-500/50 transition-all text-sm font-medium shadow-lg flex items-center gap-2 group"
            >
              <svg className="w-4 h-4 text-purple-400 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Go back</span>
            </button>
            
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              Settings
            </button>
            <button 
              onClick={() => navigate('/more-games')}
              className="px-6 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all text-sm font-medium hover:scale-105 shadow-lg"
            >
              More Games
            </button>
          </div>
        </div>
        <div className="flex flex-1 overflow-hidden relative">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-8 max-w-4xl mx-auto w-full pb-32">
              <div className="space-y-4">
                {messages.length === 0 && (
                  <div className="text-center text-gray-400 mt-20">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-400 mb-4">
                      MocahAI
                    </h2>
                    <p className="text-lg">Ask me anything...</p>
                  </div>
                )}
                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-purple-600/30 border border-purple-500/30 text-white'
                          : 'bg-white/10 border border-white/20 text-gray-200'
                      } backdrop-blur-md`}
                    >
                      {msg.role === 'assistant' ? (
                        <div className="prose prose-invert max-w-none">
                          {msg.terminal && msg.terminal.length > 0 && (
                            <div className="mb-3 rounded-lg bg-black/70 border border-white/10 p-3 font-mono text-[11px] text-gray-400 opacity-75 max-h-52 overflow-y-auto">
                              <p className="text-[10px] uppercase tracking-widest text-gray-600 mb-1.5">MocahAI terminal</p>
                              {msg.terminal.map((line, li) => (
                                <p key={li} className={line.startsWith('$') ? 'text-purple-300/90' : 'text-gray-500'}>{line}</p>
                              ))}
                            </div>
                          )}
                          <ReactMarkdown>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                {isTyping && (
                  <div className="flex justify-start">
                    <div className="max-w-[80%] px-4 py-3 rounded-2xl bg-white/10 border border-white/20 text-gray-200 backdrop-blur-md">
                      <div className="prose prose-invert max-w-none">
                        <ReactMarkdown>
                          {typingContent}
                        </ReactMarkdown>
                        <span className="inline-block w-2 h-4 bg-purple-400 ml-1 animate-pulse" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>
            <div className="fixed bottom-0 left-0 right-0 w-full flex justify-center pb-8 bg-gradient-to-t from-black/90 via-black/70 to-transparent pt-6 z-20">
              <div className="w-full max-w-2xl px-4">
                {attachedFiles.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2 animate-fade-down">
                    {attachedFiles.map((f) => (
                      <div key={f.id} className="group flex items-center gap-2 pl-3 pr-2 py-2 rounded-xl bg-white/[0.06] border border-white/10 hover:border-purple-500/40 transition-all">
                        <svg className="w-4 h-4 text-purple-300 shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                        </svg>
                        <span className="text-xs text-white/85 max-w-[180px] truncate">{f.label || f.file.name}</span>
                        <span className="text-[10px] text-white/35 shrink-0">{Math.max(1, Math.round(f.file.size / 1024))} KB</span>
                        <button
                          type="button"
                          onClick={() => setAttachedFiles(prev => prev.filter(x => x.id !== f.id))}
                          className="w-5 h-5 rounded-full bg-red-500/80 hover:bg-red-500 text-white text-xs flex items-center justify-center transition-all"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {images.length > 0 && (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {images.map((img) => (
                      <div key={img.id} className="relative group">
                        <img
                          src={img.data}
                          alt="Preview"
                          className="w-20 h-20 object-cover rounded-lg border border-white/20"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-white text-xs flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleSendMessage} className="relative flex items-center gap-2.5">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      files.forEach((file) => {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          const dataUrl = event.target?.result as string;
                          setImages((prev) => [...prev, { id: Date.now().toString() + Math.random().toString(36).slice(2, 6), data: dataUrl, file }]);
                        };
                        reader.readAsDataURL(file);
                      });
                      e.target.value = '';
                    }}
                  />
                  <input
                    ref={folderInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      addFiles(Array.from(e.target.files || []).map((f) => {
                        const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || '';
                        const folder = rel.includes('/') ? rel.split('/')[0] : f.name;
                        return { file: f, label: folder };
                      }));
                      e.target.value = '';
                    }}
                  />
                  <div className="relative flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute left-3 top-3.5 w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/60 hover:text-purple-300 transition-all flex items-center justify-center z-10"
                      title="Add images"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
                      </svg>
                    </button>
                    <textarea
                      ref={inputRef}
                      value={message}
                      onChange={(e) => {
                        setMessage(e.target.value);
                        const el = e.target;
                        el.style.height = 'auto';
                        el.style.height = Math.min(el.scrollHeight, 160) + 'px';
                      }}
                      onKeyDown={handleKeyDown}
                      onPaste={handlePaste}
                      rows={1}
                      placeholder="Ask MocahAI anything.."
                      className="w-full pl-14 pr-5 py-4 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/50 transition-all duration-300 backdrop-blur-md shadow-2xl text-lg resize-none max-h-40"
                    />
                    {isTyping && (
                      <button
                        type="button"
                        onClick={handleStopTyping}
                        className="absolute right-4 top-1/2 -translate-y-1/2 w-8 h-8 bg-red-500/90 hover:bg-red-600 rounded-lg transition-all duration-300 shadow-lg z-30 flex items-center justify-center"
                      >
                        <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                          <rect x="6" y="6" width="12" height="12" rx="1" />
                        </svg>
                      </button>
                    )}
                    {isPaused && (
                      <button
                        type="button"
                        onClick={handleContinueTyping}
                        className="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1 bg-green-500/90 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all duration-300 shadow-lg z-30"
                      >
                        Continue
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => folderInputRef.current?.click()}
                    className="shrink-0 w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/15 border border-white/10 text-white/60 hover:text-purple-300 transition-all flex items-center justify-center"
                    title="Add folders or files"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Settings
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {contextMenu && (
        <div
          className="fixed z-50 bg-black/90 border border-white/20 rounded-xl shadow-2xl backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => deleteChat(contextMenu.chatId)}
            className="px-4 py-3 text-red-400 hover:bg-red-500/20 transition-all text-sm w-full text-left rounded-t-xl"
          >
            Delete Chat
          </button>
        </div>
      )}

      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
