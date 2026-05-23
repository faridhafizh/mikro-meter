import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getFilePath(filename: string): string {
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify([], null, 2), 'utf-8');
  }
  return filePath;
}

function getSettingsFilePath(): string {
  const filePath = path.join(DATA_DIR, 'settings.json');
  if (!fs.existsSync(filePath)) {
    const defaultSettings = {
      telegram: {
        enabled: false,
        botToken: '',
        chatId: '',
        alertOnOutage: true,
        alertOnBandwidth: true,
        alertOnBackup: true,
      },
      whatsapp: {
        enabled: false,
        webhookUrl: '',
        alertOnOutage: false,
        alertOnBandwidth: false,
        alertOnBackup: false,
      },
      speedtest: {
        schedule: 'none',
        targetHost: 'ping.mikrotik.com'
      },
      backupRetentionDays: 30,
      ai: {
        enabled: false,
        provider: 'openai',
        apiUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.3,
      }
    };
    fs.writeFileSync(filePath, JSON.stringify(defaultSettings, null, 2), 'utf-8');
  }
  return filePath;
}

// Interfaces
export interface RouterConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  password?: string; // Keep optional, but stored
  monitoredInterfaces?: string[]; // e.g. ['ether1', 'wlan1']
  backupSchedule?: 'none' | 'daily' | 'weekly';
  lastBackupTime?: string;
  status?: 'online' | 'offline';
  lastChecked?: string;
  latitude?: number;
  longitude?: number;
}

export interface BackupLog {
  id: string;
  routerId: string;
  routerName: string;
  filename: string;
  format: 'rsc' | 'backup';
  sizeBytes: number;
  timestamp: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface OutageLog {
  id: string;
  routerId: string;
  routerName: string;
  event: 'offline' | 'online';
  timestamp: string;
  durationMs?: number; // In case of 'online', duration of preceding outage
}

export interface AlertRule {
  id: string;
  routerId: string;
  routerName: string;
  interfaceName?: string; // empty if CPU/Memory alert
  metric: 'cpu' | 'memory' | 'rx' | 'tx';
  operator: 'gt' | 'lt';
  threshold: number; // Mbps for traffic, % for cpu/memory
  isActive: boolean;
  isTriggered?: boolean;
  lastTriggered?: string;
}

export interface HotspotVoucher {
  id: string;
  routerId: string;
  routerName: string;
  username: string;
  password?: string;
  profile: string;
  limitUptime?: string;
  limitBytes?: number;
  timestamp: string;
  status: 'active' | 'used' | 'expired';
}

export interface SpeedtestLog {
  id: string;
  routerId: string;
  routerName: string;
  timestamp: string;
  downloadMbps: number;
  uploadMbps: number;
  latencyMs: number;
  jitterMs: number;
  packetLossPercent: number;
  status: 'success' | 'failed';
  error?: string;
}

export interface AISettings {
  enabled: boolean;
  provider: 'openai' | 'ollama' | 'custom';
  apiUrl: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AppSettings {
  telegram: {
    enabled: boolean;
    botToken: string;
    chatId: string;
    alertOnOutage: boolean;
    alertOnBandwidth: boolean;
    alertOnBackup: boolean;
  };
  whatsapp: {
    enabled: boolean;
    webhookUrl: string;
    alertOnOutage: boolean;
    alertOnBandwidth: boolean;
    alertOnBackup: boolean;
  };
  speedtest: {
    schedule: 'none' | '4hours' | '12hours' | 'daily';
    targetHost: string;
  };
  backupRetentionDays: number;
  ai?: AISettings;
}

// Helpers for generic JSON read/write
function readJSON<T>(filename: string): T {
  const filePath = getFilePath(filename);
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data) as T;
  } catch (e) {
    console.error(`Error reading ${filename}:`, e);
    return [] as unknown as T;
  }
}

function writeJSON<T>(filename: string, data: T): void {
  const filePath = getFilePath(filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error(`Error writing ${filename}:`, e);
  }
}

// ROUTERS
export function getRouters(): RouterConfig[] {
  return readJSON<RouterConfig[]>('routers.json');
}

export function saveRouter(router: RouterConfig): RouterConfig {
  const routers = getRouters();
  const index = routers.findIndex(r => r.id === router.id);
  
  if (index >= 0) {
    // Merge password if not provided in edit
    if (!router.password && routers[index].password) {
      router.password = routers[index].password;
    }
    routers[index] = { ...routers[index], ...router };
  } else {
    routers.push(router);
  }
  writeJSON('routers.json', routers);
  return router;
}

export function deleteRouter(id: string): boolean {
  const routers = getRouters();
  const filtered = routers.filter(r => r.id !== id);
  if (filtered.length === routers.length) return false;
  writeJSON('routers.json', filtered);
  
  // Clean up backups & alerts related to this router as well
  const alerts = getAlertRules();
  writeJSON('alerts.json', alerts.filter(a => a.routerId !== id));
  
  return true;
}

// SETTINGS
export function getSettings(): AppSettings {
  const filePath = getSettingsFilePath();
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(data) as AppSettings;
    if (!parsed.speedtest) {
      parsed.speedtest = { schedule: 'none', targetHost: 'ping.mikrotik.com' };
    }
    if (parsed.backupRetentionDays === undefined) {
      parsed.backupRetentionDays = 30;
    }
    if (!parsed.ai) {
      parsed.ai = {
        enabled: false,
        provider: 'openai',
        apiUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.3,
      };
    }
    return parsed;
  } catch (e) {
    console.error('Error reading settings.json:', e);
    return {
      telegram: { enabled: false, botToken: '', chatId: '', alertOnOutage: true, alertOnBandwidth: true, alertOnBackup: true },
      whatsapp: { enabled: false, webhookUrl: '', alertOnOutage: false, alertOnBandwidth: false, alertOnBackup: false },      speedtest: {
        schedule: 'none',
        targetHost: 'ping.mikrotik.com'
      },
      backupRetentionDays: 30,
      ai: {
        enabled: false,
        provider: 'openai',
        apiUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.3,
      }
    };
  }
}

export function saveSettings(settings: AppSettings): void {
  const filePath = getSettingsFilePath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(settings, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error writing settings.json:', e);
  }
}

// BACKUPS
export function getBackups(): BackupLog[] {
  return readJSON<BackupLog[]>('backups.json');
}

export function addBackupLog(log: BackupLog): void {
  const backups = getBackups();
  backups.push(log);
  writeJSON('backups.json', backups);
}

// OUTAGES
export function getOutages(): OutageLog[] {
  return readJSON<OutageLog[]>('outages.json');
}

export function addOutageLog(log: OutageLog): void {
  const outages = getOutages();
  outages.push(log);
  writeJSON('outages.json', outages);
}

// ALERT RULES
export function getAlertRules(): AlertRule[] {
  return readJSON<AlertRule[]>('alerts.json');
}

export function saveAlertRule(rule: AlertRule): AlertRule {
  const rules = getAlertRules();
  const index = rules.findIndex(r => r.id === rule.id);
  if (index >= 0) {
    rules[index] = rule;
  } else {
    rules.push(rule);
  }
  writeJSON('alerts.json', rules);
  return rule;
}

export function deleteAlertRule(id: string): boolean {
  const rules = getAlertRules();
  const filtered = rules.filter(r => r.id !== id);
  if (filtered.length === rules.length) return false;
  writeJSON('alerts.json', filtered);
  return true;
}

// ── HISTORICAL STATS PERSISTENCE ──

export interface StatsDataPoint {
  timestamp: string;
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  rxBps: Record<string, number>;
  txBps: Record<string, number>;
  activePppoe: number;
}

export function getStatsHistory(routerId: string): StatsDataPoint[] {
  const allStats = readJSON<Record<string, StatsDataPoint[]>>('stats_history.json');
  return allStats[routerId] || [];
}

export function appendStatsPoint(routerId: string, point: StatsDataPoint): void {
  const allStats = readJSON<Record<string, StatsDataPoint[]>>('stats_history.json');
  if (!allStats[routerId]) allStats[routerId] = [];
  allStats[routerId].push(point);
  // Keep max 5000 or 7 days of data per router
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  allStats[routerId] = allStats[routerId].filter(
    p => new Date(p.timestamp).getTime() > cutoff
  );
  writeJSON('stats_history.json', allStats);
}

export function getStatsHistoryInRange(
  routerId: string,
  rangeMs: number
): StatsDataPoint[] {
  const allStats = getStatsHistory(routerId);
  const cutoff = Date.now() - rangeMs;
  return allStats.filter(p => new Date(p.timestamp).getTime() > cutoff);
}

/** Clean up stats older than 7 days */
export function cleanupOldStats(): number {
  const allStats = readJSON<Record<string, StatsDataPoint[]>>('stats_history.json');
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const routerId of Object.keys(allStats)) {
    const before = allStats[routerId].length;
    allStats[routerId] = allStats[routerId].filter(
      p => new Date(p.timestamp).getTime() > cutoff
    );
    removed += before - allStats[routerId].length;
  }
  writeJSON('stats_history.json', allStats);
  return removed;
}

// ── CONFIG SNAPSHOTS (for Config Audit/Diff) ──

export interface ConfigSnapshot {
  id: string;
  routerId: string;
  routerName: string;
  timestamp: string;
  content: string;
  label: string; // e.g. "Scheduled backup", "Manual backup"
  filename: string;
}

export function getConfigSnapshots(routerId?: string): ConfigSnapshot[] {
  const snapshots = readJSON<ConfigSnapshot[]>('config_snapshots.json');
  const sorted = snapshots.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  if (routerId) return sorted.filter(s => s.routerId === routerId);
  return sorted;
}

export function addConfigSnapshot(snapshot: ConfigSnapshot): void {
  const snapshots = readJSON<ConfigSnapshot[]>('config_snapshots.json');
  snapshots.push(snapshot);
  writeJSON('config_snapshots.json', snapshots);
}

export function deleteConfigSnapshot(id: string): boolean {
  const snapshots = readJSON<ConfigSnapshot[]>('config_snapshots.json');
  const filtered = snapshots.filter(s => s.id !== id);
  if (filtered.length === snapshots.length) return false;
  writeJSON('config_snapshots.json', filtered);
  return true;
}

export function cleanupOldConfigSnapshots(retentionDays: number = 90): number {
  const snapshots = readJSON<ConfigSnapshot[]>('config_snapshots.json');
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  const before = snapshots.length;
  const remaining = snapshots.filter(s => new Date(s.timestamp).getTime() > cutoff);
  writeJSON('config_snapshots.json', remaining);
  return before - remaining.length;
}

// Helper to resolve backup paths
export function getBackupDirectory(): string {
  const backupDir = path.join(DATA_DIR, 'backup_files');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  return backupDir;
}

// VOUCHERS
export function getVouchers(): HotspotVoucher[] {
  return readJSON<HotspotVoucher[]>('vouchers.json');
}

export function saveVoucher(voucher: HotspotVoucher): HotspotVoucher {
  const vouchers = getVouchers();
  const index = vouchers.findIndex(v => v.id === voucher.id);
  if (index >= 0) {
    vouchers[index] = voucher;
  } else {
    vouchers.push(voucher);
  }
  writeJSON('vouchers.json', vouchers);
  return voucher;
}

export function deleteVoucher(id: string): boolean {
  const vouchers = getVouchers();
  const filtered = vouchers.filter(v => v.id !== id);
  if (filtered.length === vouchers.length) return false;
  writeJSON('vouchers.json', filtered);
  return true;
}

// BACKUP CLEANUP
export function cleanupOldBackups(retentionDays: number): { deleted: number; freedBytes: number } {
  const backups = getBackups();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - retentionDays);

  const cutoffTime = cutoff.getTime();
  const backupDir = getBackupDirectory();
  let deleted = 0;
  let freedBytes = 0;

  const remaining = backups.filter(backup => {
    const backupTime = new Date(backup.timestamp).getTime();
    if (backupTime < cutoffTime && backup.status === 'success') {
      // Delete the file
      const filePath = path.join(backupDir, backup.filename);
      try {
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          freedBytes += stats.size;
          fs.unlinkSync(filePath);
        }
        deleted++;
      } catch (e) {
        console.error(`Failed to delete backup file ${backup.filename}:`, e);
      }
      return false;
    }
    return true;
  });

  writeJSON('backups.json', remaining);
  return { deleted, freedBytes };
}

// SPEEDTESTS
export function getSpeedtests(): SpeedtestLog[] {
  return readJSON<SpeedtestLog[]>('speedtests.json');
}

export function addSpeedtestLog(log: SpeedtestLog): void {
  const speedtests = getSpeedtests();
  speedtests.push(log);
  if (speedtests.length > 100) {
    speedtests.shift();
  }
  writeJSON('speedtests.json', speedtests);
}
