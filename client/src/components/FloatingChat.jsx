import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../api';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;

// Pages where the widget is hidden
const HIDDEN_PATHS = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

function initials(name) {
  if (!name) return '?';
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function FloatingChat() {
  const { user } = useAuth();
  const location = useLocation();
  const token = localStorage.getItem('token');

  const [open, setOpen] = useState(false);
  const [leagueId, setLeagueId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [unread, setUnread] = useState(0);
  const [text, setText] = useState('');

  const socketRef = useRef(null);
  const bottomRef = useRef(null);
  const openRef = useRef(false);

  // Keep openRef in sync (used inside socket callback)
  useEffect(() => { openRef.current = open; }, [open]);

  // Auto-scroll when window is open and messages arrive
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Fetch user's leagues → pick first active one
  useEffect(() => {
    if (!user) return;
    api.get('/leagues').then(res => {
      const leagues = res.data.leagues || [];
      const pick =
        leagues.find(l => l.status === 'active') ||
        leagues.find(l => l.status === 'drafting') ||
        leagues[0];
      if (pick) setLeagueId(pick.id);
    }).catch(() => {});
  }, [user]);

  // Socket connection tied to leagueId
  useEffect(() => {
    if (!leagueId || !user || !token) return;
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('league_chat_join', { leagueId, token });
    });

    socket.on('league_chat_history', (history) => {
      setMessages(history.slice(-50));
    });

    socket.on('league_chat_message', (msg) => {
      setMessages(prev => [...prev, msg]);
      if (!openRef.current) setUnread(n => n + 1);
    });

    return () => socket.disconnect();
  }, [leagueId, user, token]);

  const handleToggle = () => {
    setOpen(o => {
      if (!o) setUnread(0); // reset badge when opening
      return !o;
    });
  };

  const send = () => {
    const trimmed = text.trim();
    if (!trimmed || !leagueId) return;
    socketRef.current?.emit('league_chat_send', { leagueId, token, text: trimmed, gifUrl: null });
    setText('');
  };

  // Hide on auth/landing pages or when not logged in or no league
  const pathname = location.pathname;
  if (!user || HIDDEN_PATHS.includes(pathname) || !leagueId) return null;

  const myInitials = initials(user.display_name || user.username);

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9900 }}>

      {/* ── Chat window (slides up from bubble) ── */}
      {open && (
        <div style={{
          position: 'absolute', bottom: 64, right: 0,
          width: 300, background: '#1f2937',
          borderRadius: 14, border: '0.5px solid #374151',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>

          {/* Header */}
          <div style={{
            padding: '10px 14px', borderBottom: '0.5px solid #374151',
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#1f2937', flexShrink: 0,
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: '#22c55e', flexShrink: 0,
              animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
            }} />
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 13, flex: 1 }}>
              Trash Talk
            </span>
            <button
              onClick={handleToggle}
              style={{ color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, lineHeight: 1, padding: 2 }}
            >✕</button>
          </div>

          {/* Messages */}
          <div style={{
            height: 200, overflowY: 'auto', padding: '10px 12px',
            display: 'flex', flexDirection: 'column', gap: 10,
            background: '#111827',
          }}>
            {messages.length === 0 ? (
              <div style={{ color: '#4b5563', fontSize: 12, textAlign: 'center', marginTop: 24 }}>
                No messages yet
              </div>
            ) : (
              messages.map(msg => {
                const isMe = msg.user_id === user?.id;
                return (
                  <div key={msg.id} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: 6 }}>
                    {/* Avatar */}
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: isMe ? '#3b82f622' : '#37415188',
                      border: isMe ? '1px solid #3b82f644' : '1px solid #4b556388',
                      color: isMe ? '#60a5fa' : '#9ca3af',
                      fontSize: 9, fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {isMe ? myInitials : initials(msg.username)}
                    </div>

                    {/* Bubble + timestamp */}
                    <div style={{ maxWidth: '75%', display: 'flex', flexDirection: 'column', gap: 2, alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                      {msg.gif_url ? (
                        <img src={msg.gif_url} alt="GIF" style={{ maxWidth: 160, borderRadius: 10 }} />
                      ) : msg.text ? (
                        <div style={{
                          background: isMe ? '#3b82f6' : '#374151',
                          color: '#fff', fontSize: 12,
                          padding: '6px 10px',
                          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          lineHeight: 1.45, wordBreak: 'break-word',
                        }}>
                          {msg.text}
                        </div>
                      ) : null}
                      <div style={{ color: '#6b7280', fontSize: 9, padding: '0 2px', display: 'flex', gap: 4 }}>
                        {!isMe && <span style={{ color: '#9ca3af', fontWeight: 500 }}>{msg.username}</span>}
                        <span>{fmtTime(msg.created_at)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input row */}
          <div style={{
            padding: '8px 10px', borderTop: '0.5px solid #374151',
            display: 'flex', gap: 6, alignItems: 'center',
            background: '#1f2937', flexShrink: 0,
          }}>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
              placeholder="Talk your trash..."
              style={{
                flex: 1, background: '#111827',
                border: '0.5px solid #374151', borderRadius: 8,
                color: '#fff', fontSize: 12, padding: '6px 10px', outline: 'none',
              }}
            />
            <button
              onClick={send}
              disabled={!text.trim()}
              style={{
                width: 28, height: 28, borderRadius: 8, border: 'none', flexShrink: 0,
                background: text.trim() ? '#3b82f6' : '#374151',
                color: '#fff', cursor: text.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
              }}
            >↑</button>
          </div>
        </div>
      )}

      {/* ── Bubble button ── */}
      <button
        onClick={handleToggle}
        style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#3b82f6', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 22, boxShadow: '0 4px 20px rgba(59,130,246,0.45)',
          position: 'relative',
        }}
      >
        💬
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            width: 18, height: 18, borderRadius: '50%',
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #111827',
          }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
