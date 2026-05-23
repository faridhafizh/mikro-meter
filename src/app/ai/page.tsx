'use client';

import { useState, useRef, useEffect } from 'react';
import {
  Bot,
  Send,
  Trash2,
  AlertCircle,
  Server,
  Wifi,
  Settings,
  Database,
  Bell,
  Ticket,
  Activity,
  Terminal,
  Gauge,
  Shield,
  ShieldCheck,
  Loader2,
  User,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  action?: {
    name: string;
    result: unknown;
  };
  error?: string;
  timestamp: Date;
}

// Action icons for result display
const actionIcons: Record<string, LucideIcon> = {
  list_routers: Server,
  get_router: Server,
  add_router: Server,
  update_router: Server,
  delete_router: Server,
  test_connection: Wifi,
  run_command: Terminal,
  run_speedtest: Gauge,
  get_stats: Activity,
  block_ip: Shield,
  unblock_ip: ShieldCheck,
  make_dhcp_static: Server,
  list_alerts: Bell,
  add_alert: Bell,
  delete_alert: Bell,
  list_backups: Database,
  create_backup: Database,
  get_settings: Settings,
  update_settings: Settings,
  list_vouchers: Ticket,
  create_voucher: Ticket,
  delete_voucher: Ticket,
  get_outages: AlertCircle,
  get_speedtests: Gauge,
};

function formatActionResult(name: string, result: unknown): string {
  if (!result) return '';
  
  if (name === 'list_routers' && Array.isArray(result)) {
    const online = (result as Array<{status: string}>).filter(r => r.status === 'online').length;
    return `Found **${result.length}** router(s) — **${online}** online, **${result.length - online}** offline`;
  }
  
  if (name === 'run_speedtest') {
    const r = result as { downloadMbps?: number; uploadMbps?: number; latencyMs?: number };
    if (r.downloadMbps) {
      return `📥 Download: **${r.downloadMbps.toFixed(1)} Mbps** | 📤 Upload: **${r.uploadMbps?.toFixed(1) ?? 'N/A'} Mbps** | ⏱ Latency: **${r.latencyMs ?? 'N/A'} ms**`;
    }
  }
  
  if (name === 'block_ip' || name === 'unblock_ip') {
    const r = result as { message?: string; success?: boolean };
    return r.message || `✅ ${r.success ? 'Success' : 'Failed'}`;
  }
  
  if (name === 'create_backup') {
    const r = result as { results?: Array<{format: string; filename: string; sizeBytes: number}> };
    if (r.results) {
      return r.results.map(res => `✅ ${res.format.toUpperCase()}: ${res.filename} (${(res.sizeBytes / 1024).toFixed(1)} KB)`).join('\n');
    }
  }
  
  if (name === 'create_voucher') {
    const vr = result as { voucherCode?: string; routerName?: string; profile?: string };
    if (vr.voucherCode) {
      return `🔑 Voucher Code: **${vr.voucherCode}** | Router: ${vr.routerName} | Profile: ${vr.profile}`;
    }
  }
  
  if (name === 'add_router') {
    const ar = result as { id?: string; name?: string; host?: string; status?: string };
    if (ar.id) {
      return `✅ Router **${ar.name}** added (${ar.host}) — Status: ${ar.status}`;
    }
  }
  
  return '';
}

function ActionResult({ name, result }: { name: string; result: unknown }) {
  const Icon = actionIcons[name] || Activity;
  const formatted = formatActionResult(name, result);
  
  return (
    <div className="ai-result">
      <div className="ai-result-header">
        <span className="ai-result-icon">
          <Icon size={13} />
        </span>
        <span className="ai-result-label">{name.replace(/_/g, ' ')}</span>
      </div>
      {formatted ? (
        <div className="ai-result-body">
          {formatted.split('\n').map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </div>
      ) : (
        <div className="ai-result-body">
          <pre className="ai-result-json">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function LoadingDots() {
  return (
    <div className="ai-loading">
      <span className="ai-dot" style={{ animationDelay: '0ms' }} />
      <span className="ai-dot" style={{ animationDelay: '150ms' }} />
      <span className="ai-dot" style={{ animationDelay: '300ms' }} />
    </div>
  );
}

function Markdown({ content }: { content: string }) {
  // Simple markdown rendering
  const formatted = content
    .split(/\n\n+/)
    .map((block, i) => {
      // Headers
      if (block.startsWith('### ')) {
        return <h3 key={i} className="ai-md-h3">{block.slice(4)}</h3>;
      }
      if (block.startsWith('## ')) {
        return <h2 key={i} className="ai-md-h2">{block.slice(3)}</h2>;
      }
      if (block.startsWith('# ')) {
        return <h1 key={i} className="ai-md-h1">{block.slice(2)}</h1>;
      }
      
      // Code blocks
      if (block.includes('```')) {
        const parts = block.split('```');
        return parts.map((part, j) => {
          if (j % 2 === 1) {
            const lines = part.split('\n');
            const lang = lines[0];
            const code = lines.slice(1).join('\n');
            return <pre key={`${i}-${j}`} className="ai-code-block"><code>{code || lang}</code></pre>;
          }
          return <p key={`${i}-${j}`} className="ai-md-p">{renderInline(part)}</p>;
        });
      }
      
      // Bullet lists
      if (block.includes('\n- ')) {
        const lines = block.split('\n');
        return (
          <ul key={i} className="ai-md-ul">
            {lines.filter(l => l.startsWith('- ')).map((line, j) => (
              <li key={j}>{renderInline(line.slice(2))}</li>
            ))}
          </ul>
        );
      }
      
      return <p key={i} className="ai-md-p">{renderInline(block)}</p>;
    });

  return <>{formatted}</>;
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/g);
    return codeParts.map((cp, j) => {
      if (cp.startsWith('`') && cp.endsWith('`')) {
        return <code key={`${i}-${j}`} className="ai-inline-code">{cp.slice(1, -1)}</code>;
      }
      return cp;
    });
  });
}

// ──────────────────────────────────────────────
// Suggestion Chips
// ──────────────────────────────────────────────

const suggestions = [
  'Show me all routers',
  'What routers are online?',
  'Run a speedtest',
  'Create a backup',
  'List recent alerts',
  'Show system settings',
];

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export default function AIPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 **Welcome to AI Assistant!**\n\nI can help you manage your network through natural language. Try asking me to:\n\n• Show router status and statistics\n• Run speedtests and manage backups\n• Configure alerts and settings\n• Create hotspot vouchers\n• Block/unblock IP addresses\n• Execute RouterOS commands',
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setShowSuggestions(false);

    const history = messages.map(m => ({
      role: m.role,
      content: m.content,
    }));

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), history }),
      });

      const data = await res.json();

      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.message || 'Sorry, I encountered an error processing your request.',
        action: data.actionExecuted,
        error: data.error,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ Network error: ${errorMsg}. Please check your connection and try again.`,
        error: errorMsg,
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([{
      role: 'assistant',
      content: '👋 **Welcome back!**\n\nI can help you manage your network through natural language. What would you like to do?',
      timestamp: new Date(),
    }]);
    setShowSuggestions(true);
  };

  return (
    <div className="ai-page">
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2">
            <div className="section-icon" style={{ background: 'var(--purple-dim)', width: 28, height: 28, borderRadius: 8 }}>
              <Bot size={15} style={{ color: 'var(--purple)' }} />
            </div>
            <h1 className="page-title" style={{ fontSize: '1.3rem' }}>AI Assistant</h1>
          </div>
          <p className="page-subtitle">Natural language network management</p>
        </div>
        <div className="flex gap-1 items-center">
          <Link href="/settings" className="btn btn-ghost btn-sm">
            <Settings size={14} />
            Configure
          </Link>
          <button className="btn btn-ghost btn-sm" onClick={clearChat} title="Clear conversation">
            <Trash2 size={14} />
            Clear
          </button>
        </div>
      </div>

      {/* Chat Container */}
      <div className="ai-chat-container">
        {/* Messages */}
        <div className="ai-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`ai-msg ai-msg-${msg.role}`}>
              <div className="ai-avatar">
                {msg.role === 'assistant' ? (
                  <Bot size={16} style={{ color: 'var(--purple)' }} />
                ) : (
                  <User size={16} style={{ color: 'var(--cyan)' }} />
                )}
              </div>
              <div className="ai-bubble">
                <Markdown content={msg.content} />
                
                {/* Action Result Display */}
                {msg.action && (
                  <ActionResult name={msg.action.name} result={msg.action.result} />
                )}
                
                {/* Error Display */}
                {msg.error && (
                  <div className="ai-error">
                    <AlertCircle size={14} />
                    <span>{msg.error}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div className="ai-msg ai-msg-assistant">
              <div className="ai-avatar">
                <Bot size={16} style={{ color: 'var(--purple)' }} />
              </div>
              <div className="ai-bubble">
                <LoadingDots />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        {showSuggestions && messages.length <= 1 && (
          <div className="ai-suggestions">
            <p className="ai-suggestions-label">Try asking:</p>
            <div className="ai-chip-row">
              {suggestions.map((s, i) => (
                <button
                  key={i}
                  className="ai-chip"
                  onClick={() => sendMessage(s)}
                  disabled={loading}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="ai-input-bar">
          <div className="ai-input-wrap">
            <textarea
              ref={inputRef}
              className="ai-input"
              placeholder="Ask me to manage your network..."
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={loading}
            />
            <button
              className="btn btn-primary btn-sm ai-send-btn"
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <p className="ai-input-hint">Press Enter to send, Shift+Enter for new line</p>
        </div>
      </div>

      <style jsx>{`
        .ai-page { max-width: 860px; margin: 0 auto; display: flex; flex-direction: column; height: calc(100vh - 6rem); }
        .ai-chat-container { flex: 1; display: flex; flex-direction: column; background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; overflow: hidden; position: relative; }
        .ai-messages { flex: 1; overflow-y: auto; padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; }
        .ai-msg { display: flex; gap: 0.75rem; animation: fadeInUp 0.3s ease-out; }
        .ai-msg-user { flex-direction: row-reverse; }
        .ai-avatar { width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; background: rgba(255,255,255,0.04); border: 1px solid var(--border); }
        .ai-bubble { max-width: 80%; padding: 0.75rem 1rem; border-radius: 12px; line-height: 1.6; font-size: 0.85rem; }
        .ai-msg-assistant .ai-bubble { background: rgba(255,255,255,0.02); border: 1px solid var(--border); color: var(--text-1); border-bottom-left-radius: 4px; }
        .ai-msg-user .ai-bubble { background: var(--purple-dim); border: 1px solid rgba(139,92,246,0.15); color: var(--text-1); border-bottom-right-radius: 4px; }
        .ai-loading { display: flex; gap: 4px; align-items: center; padding: 4px 0; }
        .ai-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--purple); opacity: 0.5; animation: ai-bounce 1.2s infinite; }
        @keyframes ai-bounce { 0%, 60%, 100% { transform: translateY(0); opacity: 0.5; } 30% { transform: translateY(-4px); opacity: 1; } }
        .ai-result { margin-top: 0.75rem; background: rgba(0,0,0,0.2); border: 1px solid rgba(255,255,255,0.04); border-radius: 10px; overflow: hidden; }
        .ai-result-header { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; background: rgba(255,255,255,0.02); border-bottom: 1px solid rgba(255,255,255,0.04); }
        .ai-result-icon { width: 20px; height: 20px; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: var(--purple-dim); }
        .ai-result-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-3); }
        .ai-result-body { padding: 0.625rem 0.75rem; font-size: 0.8rem; color: var(--text-2); }
        .ai-result-json { font-family: 'JetBrains Mono', monospace; font-size: 0.7rem; white-space: pre-wrap; word-break: break-all; color: var(--text-2); line-height: 1.4; }
        .ai-error { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem; padding: 0.5rem 0.75rem; background: var(--offline-dim); border: 1px solid rgba(244,63,94,0.2); border-radius: 8px; font-size: 0.75rem; color: var(--offline); }
        .ai-suggestions { padding: 0.75rem 1.25rem 0.5rem; }
        .ai-suggestions-label { font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--text-4); margin-bottom: 0.5rem; }
        .ai-chip-row { display: flex; flex-wrap: wrap; gap: 0.375rem; }
        .ai-chip { padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 99px; border: 1px solid var(--border); background: rgba(255,255,255,0.02); color: var(--text-2); cursor: pointer; transition: var(--ease); font-family: inherit; }
        .ai-chip:hover { border-color: var(--purple-soft); background: var(--purple-dim); color: var(--purple); }
        .ai-chip:disabled { opacity: 0.4; cursor: not-allowed; }
        .ai-input-bar { padding: 0.75rem 1.25rem 1rem; border-top: 1px solid var(--border); background: rgba(0,0,0,0.15); }
        .ai-input-wrap { display: flex; gap: 0.5rem; align-items: flex-end; }
        .ai-input { flex: 1; background: var(--bg-input); border: 1px solid var(--border); border-radius: 12px; padding: 0.7rem 1rem; color: var(--text-1); font-family: inherit; font-size: 0.875rem; resize: none; max-height: 120px; transition: var(--ease); outline: none; }
        .ai-input:focus { border-color: var(--purple-soft); box-shadow: 0 0 0 4px rgba(139,92,246,0.08); }
        .ai-input::placeholder { color: var(--text-4); }
        .ai-send-btn { border-radius: 10px !important; height: 36px; width: 36px; padding: 0 !important; }
        .ai-input-hint { font-size: 0.65rem; color: var(--text-4); margin-top: 0.375rem; text-align: right; }
        /* Markdown styling */
        :global(.ai-md-h1) { font-size: 1.1rem; font-weight: 700; margin: 0.5rem 0; color: var(--text-1); }
        :global(.ai-md-h2) { font-size: 1rem; font-weight: 700; margin: 0.4rem 0; color: var(--text-1); }
        :global(.ai-md-h3) { font-size: 0.9rem; font-weight: 600; margin: 0.3rem 0; color: var(--text-1); }
        :global(.ai-md-p) { margin: 0.25rem 0; }
        :global(.ai-md-ul) { margin: 0.25rem 0; padding-left: 1.25rem; }
        :global(.ai-md-ul li) { margin: 0.125rem 0; }
        :global(.ai-code-block) { margin: 0.5rem 0; padding: 0.75rem; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.06); border-radius: 8px; overflow-x: auto; }
        :global(.ai-code-block code) { font-family: 'JetBrains Mono', monospace; font-size: 0.75rem; color: var(--cyan); background: none; padding: 0; border: none; }
        :global(.ai-inline-code) { font-family: 'JetBrains Mono', monospace; font-size: 0.8em; background: rgba(139,92,246,0.1); padding: 0.1em 0.35em; border-radius: 4px; color: var(--purple-soft); border: 1px solid rgba(139,92,246,0.15); }
        @media (max-width: 768px) {
          .ai-page { height: calc(100vh - 4rem); }
          .ai-messages { padding: 1rem; }
          .ai-bubble { max-width: 90%; font-size: 0.8rem; }
          .ai-input-bar { padding: 0.625rem 1rem 0.75rem; }
        }
      `}</style>
    </div>
  );
}
