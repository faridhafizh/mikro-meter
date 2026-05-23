'use client';

import { useState, useEffect } from 'react';
import { Send, CheckCircle, AlertCircle, Save, RefreshCw, Bell, Gauge, Database, Bot, Sparkles } from 'lucide-react';

export default function SettingsPage() {
  const [settings, setSettings] = useState({
    telegram: { enabled: false, botToken: '', chatId: '', alertOnOutage: true, alertOnBandwidth: true, alertOnBackup: true },
    whatsapp: { enabled: false, webhookUrl: '', alertOnOutage: false, alertOnBandwidth: false, alertOnBackup: false },
    speedtest: { schedule: 'none', targetHost: 'ping.mikrotik.com' },
    backupRetentionDays: 30,
    ai: { enabled: false, provider: 'openai' as 'openai' | 'ollama' | 'custom', apiUrl: '', apiKey: '', model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.3 },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingTg, setTestingTg] = useState(false);
  const [testingWa, setTestingWa] = useState(false);
  const [testingAi, setTestingAi] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    fetch('/api/settings').then(r => r.json()).then(d => {
      if (d?.telegram || d?.whatsapp) {
        setSettings({
          ...d,
          speedtest: d.speedtest || { schedule: 'none', targetHost: 'ping.mikrotik.com' },
          backupRetentionDays: d.backupRetentionDays ?? 30,
          ai: d.ai || { enabled: false, provider: 'openai' as 'openai' | 'ollama' | 'custom', apiUrl: '', apiKey: '', model: 'gpt-4o-mini', maxTokens: 1024, temperature: 0.3 },
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true); setMessage(null);
    try {
      const res = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(settings) });
      if (res.ok) setMessage({ text: 'Settings saved successfully.', type: 'success' });
      else { const d = await res.json(); setMessage({ text: d.error || 'Failed to save.', type: 'error' }); }
    } catch (e) { setMessage({ text: e instanceof Error ? e.message : String(e), type: 'error' }); }
    finally { setSaving(false); }
  };

  const testTelegram = async () => {
    if (!settings.telegram.botToken || !settings.telegram.chatId) { setMessage({ text: 'Fill in Bot Token and Chat ID first.', type: 'error' }); return; }
    setTestingTg(true); setMessage(null);
    try {
      const res = await fetch('/api/settings/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'telegram', botToken: settings.telegram.botToken, chatId: settings.telegram.chatId }) });
      const d = await res.json();
      setMessage(d.success ? { text: 'Telegram test sent!', type: 'success' } : { text: d.error || 'Test failed.', type: 'error' });
    } catch (e) { setMessage({ text: e instanceof Error ? e.message : String(e), type: 'error' }); }
    finally { setTestingTg(false); }
  };

  const testWhatsapp = async () => {
    if (!settings.whatsapp.webhookUrl) { setMessage({ text: 'Fill in Webhook URL first.', type: 'error' }); return; }
    setTestingWa(true); setMessage(null);
    try {
      const res = await fetch('/api/settings/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'whatsapp', webhookUrl: settings.whatsapp.webhookUrl }) });
      const d = await res.json();
      setMessage(d.success ? { text: 'WhatsApp test sent!', type: 'success' } : { text: d.error || 'Test failed.', type: 'error' });
    } catch (e) { setMessage({ text: e instanceof Error ? e.message : String(e), type: 'error' }); }
    finally { setTestingWa(false); }
  };

  if (loading) return <div style={{ color: 'var(--text-2)', display: 'flex', gap: 8, alignItems: 'center' }}><RefreshCw size={14} className="animate-spin" /> Loading settings…</div>;

  const tg = settings.telegram;
  const wa = settings.whatsapp;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Notifications, SLA scheduling, and backup retention policy</p>
        </div>
      </div>

      {message && (
        <div className={`alert-banner ${message.type === 'success' ? 'success' : 'danger'} mb-2`}>
          {message.type === 'success' ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
          {message.text}
        </div>
      )}

      <form onSubmit={handleSave}>
        <div className="grid-settings" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem', marginBottom: '1.25rem' }}>

          {/* Telegram */}
          <div className="glass-card glow-cyan">
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--cyan-dim)' }}>
                <Bell size={12} color="var(--cyan)" />
              </div>
              Telegram Bot
            </div>
            <label className="toggle-row mb-2">
              <input type="checkbox" checked={tg.enabled} onChange={e => setSettings({ ...settings, telegram: { ...tg, enabled: e.target.checked } })} />
              Enable Telegram Notifications
            </label>
            <div className="form-group">
              <label className="form-label">Bot API Token</label>
              <input type="password" className="form-input" placeholder="123456789:ABCdef…" value={tg.botToken} disabled={!tg.enabled}
                onChange={e => setSettings({ ...settings, telegram: { ...tg, botToken: e.target.value } })} />
            </div>
            <div className="form-group">
              <label className="form-label">Chat ID / Channel</label>
              <input type="text" className="form-input" placeholder="-1001234567890 or @channel" value={tg.chatId} disabled={!tg.enabled}
                onChange={e => setSettings({ ...settings, telegram: { ...tg, chatId: e.target.value } })} />
            </div>
            <div className="divider" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alert triggers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {([['alertOnOutage', 'Router Down / Up events'], ['alertOnBandwidth', 'Bandwidth thresholds'], ['alertOnBackup', 'Backup results']] as const).map(([key, label]) => (
                <label key={key} className="toggle-row">
                  <input type="checkbox"      checked={tg[key] || false} disabled={!tg.enabled}
                    onChange={e => setSettings({ ...settings, telegram: { ...tg, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={testTelegram} disabled={testingTg || !tg.enabled}>
              {testingTg ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {testingTg ? 'Sending…' : 'Send Test Message'}
            </button>
          </div>

          {/* WhatsApp */}
          <div className="glass-card glow-purple">
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                <Bell size={12} color="var(--purple)" />
              </div>
              WhatsApp Webhook
            </div>
            <label className="toggle-row mb-2">
              <input type="checkbox" checked={wa.enabled} onChange={e => setSettings({ ...settings, whatsapp: { ...wa, enabled: e.target.checked } })} />
              Enable WhatsApp Notifications
            </label>
            <div className="form-group">
              <label className="form-label">Webhook URL</label>
              <input type="url" className="form-input" placeholder="https://api.gateway.com/send" value={wa.webhookUrl} disabled={!wa.enabled}
                onChange={e => setSettings({ ...settings, whatsapp: { ...wa, webhookUrl: e.target.value } })} />
              <span className="stat-desc">POST body: <code>{`{ "message": "…" }`}</code></span>
            </div>
            <div className="divider" />
            <div style={{ fontSize: '0.75rem', color: 'var(--text-3)', marginBottom: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alert triggers</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
              {([['alertOnOutage', 'Router Down / Up events'], ['alertOnBandwidth', 'Bandwidth thresholds'], ['alertOnBackup', 'Backup results']] as const).map(([key, label]) => (
                <label key={key} className="toggle-row">
                  <input type="checkbox"      checked={wa[key] || false} disabled={!wa.enabled}
                    onChange={e => setSettings({ ...settings, whatsapp: { ...wa, [key]: e.target.checked } })} />
                  {label}
                </label>
              ))}
            </div>
            <button type="button" className="btn btn-secondary" style={{ width: '100%' }} onClick={testWhatsapp} disabled={testingWa || !wa.enabled}>
              {testingWa ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
              {testingWa ? 'Sending…' : 'Send Test Message'}
            </button>
          </div>

          {/* Speedtest */}
          <div className="glass-card glow-cyan">
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--teal-dim)' }}>
                <Gauge size={12} color="var(--teal)" />
              </div>
              SLA Speedtest
            </div>
            <div className="form-group">
              <label className="form-label">Auto Schedule</label>
              <select className="form-select" value={settings.speedtest?.schedule || 'none'}
                onChange={e => setSettings({ ...settings, speedtest: { ...settings.speedtest, schedule: e.target.value as 'none' | '4hours' | '12hours' | 'daily' } })}>
                <option value="none">Disabled (Manual only)</option>
                <option value="4hours">Every 4 Hours</option>
                <option value="12hours">Every 12 Hours</option>
                <option value="daily">Daily</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Target Host</label>
              <input type="text" className="form-input" placeholder="ping.mikrotik.com" value={settings.speedtest?.targetHost || ''}
                onChange={e => setSettings({ ...settings, speedtest: { ...settings.speedtest, targetHost: e.target.value } })} />
              <span className="stat-desc">RouterOS v7 speed-test target endpoint.</span>
            </div>
          </div>

          {/* Backup Retention */}
          <div className="glass-card">
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--warning-dim)' }}>
                <Database size={12} color="var(--warning)" />
              </div>
              Backup Retention
            </div>
            <div className="form-group">
              <label className="form-label">Keep backups for (days)</label>
              <input type="number" className="form-input" min="1" max="365" value={settings.backupRetentionDays || 30}
                onChange={e => setSettings({ ...settings, backupRetentionDays: Math.max(1, parseInt(e.target.value) || 30) })} />
              <span className="stat-desc">Backups older than this are auto-deleted by the hourly cleanup scheduler.</span>
            </div>
            <div style={{ background: 'var(--warning-dim)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 8, padding: '0.75rem', fontSize: '0.75rem', color: 'var(--text-2)', marginTop: '0.5rem' }}>
              <strong style={{ color: 'var(--warning)' }}>⚠ Auto-Cleanup</strong>
              <p style={{ marginTop: 4 }}>The scheduler checks and removes expired files once per hour. Manual cleanup is available on the Backups page.</p>
            </div>
          </div>

          {/* AI Assistant */}
          <div className="glass-card" style={{ borderColor: settings.ai?.enabled ? 'rgba(139,92,246,0.3)' : 'var(--border)' }}>
            <div className="section-title">
              <div className="section-icon" style={{ background: 'var(--purple-dim)' }}>
                <Bot size={12} color="var(--purple)" />
              </div>
              AI Assistant
            </div>
            <label className="toggle-row mb-2">
              <input type="checkbox" checked={settings.ai?.enabled || false}
                onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, enabled: e.target.checked } })} />
              Enable AI Assistant
            </label>
            <div className="form-group">
              <label className="form-label">Provider</label>
              <select className="form-select" value={settings.ai?.provider || 'openai'}
                onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, provider: e.target.value as 'openai' | 'ollama' | 'custom' } })}>
                <option value="openai">OpenAI</option>
                <option value="ollama">Ollama (Local)</option>
                <option value="custom">Custom API</option>
              </select>
            </div>
            {(settings.ai?.provider === 'custom' || settings.ai?.provider === 'ollama') && (
              <div className="form-group">
                <label className="form-label">API URL</label>
                <input type="url" className="form-input" placeholder={settings.ai?.provider === 'ollama' ? 'http://localhost:11434/v1' : 'https://api.example.com/v1'}
                  value={settings.ai?.apiUrl || ''}
                  onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, apiUrl: e.target.value } })} />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Model</label>
              <input type="text" className="form-input" placeholder="gpt-4o-mini" value={settings.ai?.model || ''}
                onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, model: e.target.value } })} />
              <span className="stat-desc">e.g. gpt-4o-mini, llama3, gemma2</span>
            </div>
            <div className="form-group">
              <label className="form-label">API Key {settings.ai?.provider === 'ollama' ? '(optional)' : ''}</label>
              <input type="password" className="form-input" placeholder={settings.ai?.apiKey ? '••••••••' : 'sk-...'}
                value={settings.ai?.apiKey || ''}
                onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, apiKey: e.target.value } })} />
              {settings.ai?.provider === 'ollama' && <span className="stat-desc">Not needed for local Ollama unless configured.</span>}
            </div>
            <div className="divider" />
            <div className="form-row-2">
              <div className="form-group">
                <label className="form-label">Max Tokens</label>
                <input type="number" className="form-input" min="64" max="8192" step="64" value={settings.ai?.maxTokens || 1024}
                  onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, maxTokens: Math.max(64, parseInt(e.target.value) || 1024) } })} />
                <span className="stat-desc">Higher = longer responses</span>
              </div>
              <div className="form-group">
                <label className="form-label">Temperature</label>
                <input type="number" className="form-input" min="0" max="2" step="0.1" value={settings.ai?.temperature ?? 0.3}
                  onChange={e => setSettings({ ...settings, ai: { ...settings.ai!, temperature: Math.max(0, Math.min(2, parseFloat(e.target.value) || 0.3)) } })} />
                <span className="stat-desc">Lower = more precise</span>
              </div>
            </div>
            {settings.ai?.enabled && (
              <button type="button" className="btn btn-secondary" style={{ width: '100%' }}
                onClick={async () => {
                  setTestingAi(true); setMessage(null);
                  try {
                    const res = await fetch('/api/ai/settings', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ ...settings.ai, testOnly: true }),
                    });
                    const d = await res.json();
                    setMessage(d.success ? { text: d.message, type: 'success' } : { text: d.message || 'Test failed', type: 'error' });
                  } catch (e) { setMessage({ text: e instanceof Error ? e.message : String(e), type: 'error' }); }
                  finally { setTestingAi(false); }
                }}
                disabled={testingAi}
              >
                {testingAi ? <RefreshCw size={13} className="animate-spin" /> : <Sparkles size={13} />}
                {testingAi ? 'Testing…' : 'Test Connection'}
              </button>
            )}
          </div>
        </div>

        <button type="submit" className="btn btn-primary" style={{ minWidth: 160 }} disabled={saving}>
          {saving ? <><RefreshCw size={13} className="animate-spin" /> Saving…</> : <><Save size={13} /> Save Settings</>}
        </button>
      </form>
    </div>
  );
}
