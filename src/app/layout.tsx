'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  Server,
  UsersRound,
  Ticket,
  Users,
  Gauge,
  Terminal,
  Database,
  Network,
  Bell,
  Settings as SettingsIcon,
  Activity,
  Wifi,
  Menu,
  X,
  Bot,
  GitCompare,
  Globe,
  Cable,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect } from 'react';
import './globals.css';

const navGroups = [
  {
    label: 'Overview',
    items: [
      { name: 'Dashboard', path: '/', icon: LayoutDashboard },
      { name: 'Routers', path: '/routers', icon: Server },
      { name: 'Topology', path: '/topology', icon: Network },
    ],
  },
  {
    label: 'Clients',
    items: [
      { name: 'DHCP & Clients', path: '/dhcp', icon: UsersRound },
      { name: 'Hotspot Vouchers', path: '/hotspot', icon: Ticket },
      { name: 'PPPoE Analytics', path: '/pppoe', icon: Users },
    ],
  },
  {
    label: 'Operations',
    items: [
      { name: 'SLA Speedtest', path: '/speedtest', icon: Gauge },
      { name: 'Console Shell', path: '/terminal', icon: Terminal },
      { name: 'Backup Manager', path: '/backups', icon: Database },
      { name: 'Config Audit', path: '/config-audit', icon: GitCompare },
      { name: 'Interfaces', path: '/interfaces', icon: Cable },
    ],
  },
  {
    label: 'System',
    items: [
      { name: 'Routing & BGP', path: '/routing', icon: Globe },
      { name: 'Alerts & Outages', path: '/alerts', icon: Bell },
      { name: 'AI Assistant', path: '/ai', icon: Bot },
      { name: 'Settings', path: '/settings', icon: SettingsIcon },
    ],
  },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState('dark');

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    if (stored) {
      setTheme(stored);
      document.documentElement.setAttribute('data-theme', stored);
    } else {
      const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
      if (prefersLight) {
        setTheme('light');
        document.documentElement.setAttribute('data-theme', 'light');
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
      }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <html lang="en">
      <head>
        <title>MikroMeter — MikroTik Monitoring</title>
        <meta name="description" content="Premium MikroTik backup, monitoring, alerts, and analytics panel" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
      </head>
      <body>
        <div className="app-container">
          {/* Mobile backdrop */}
          <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={closeSidebar} />

          {/* Sidebar */}
          <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
            {/* Brand */}
            <div className="brand">
              <div style={{
                width: 30, height: 30,
                background: 'var(--gradient-brand)',
                borderRadius: 9,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 12px rgba(0,212,255,0.3)',
              }}>
                <Wifi size={16} color="#fff" />
              </div>
              <div>
                <span className="brand-logo">MikroMeter</span>
                <div style={{ fontSize: '0.55rem', color: 'var(--text-4)', fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', marginTop: -2 }}>Network Control</div>
              </div>
            </div>

            {/* Close button for mobile */}
            <button
              className="menu-toggle"
              onClick={closeSidebar}
              style={{ alignSelf: 'flex-end', marginBottom: '0.5rem' }}
            >
              <X size={18} />
            </button>

            {/* Theme Toggle & Quick status indicator */}
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
              <div style={{
                flex: 1,
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                padding: '0.625rem 0.75rem',
                background: 'rgba(16, 217, 160, 0.06)',
                border: '1px solid rgba(16, 217, 160, 0.12)',
                borderRadius: 10, fontSize: '0.7rem', color: 'var(--text-2)'
              }}>
                <span className="dot dot-online" />
                <span style={{ fontWeight: 600, color: 'var(--online)' }}>Normal</span>
              </div>
              
              <button
                onClick={toggleTheme}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0.625rem',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  color: 'var(--text-2)',
                  cursor: 'pointer',
                  transition: 'var(--ease)'
                }}
                title="Toggle Theme"
              >
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>

            {/* Nav groups */}
            <nav style={{ flex: 1 }} onClick={closeSidebar}>
              {navGroups.map((group) => (
                <div key={group.label} style={{ marginBottom: '0.25rem' }}>
                  <div className="nav-section-label">{group.label}</div>
                  <ul className="nav-links">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = pathname === item.path;
                      return (
                        <li key={item.path}>
                          <Link href={item.path} className={`nav-link${isActive ? ' active' : ''}`}>
                            <Icon size={15} />
                            <span>{item.name}</span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>

            <div className="sidebar-footer">
              <Activity size={10} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              v1.0.0 · Enterprise
            </div>
          </aside>

          {/* Mobile header bar */}
          <div className="mobile-header">
            <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
              <Menu size={20} />
            </button>
            <span className="brand-logo">MikroMeter</span>
          </div>

          {/* Main */}
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
