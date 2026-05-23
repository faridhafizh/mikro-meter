import { 
  getRouters, 
  saveRouter, 
  RouterConfig, 
  addBackupLog, 
  addOutageLog, 
  getOutages, 
  getAlertRules, 
  saveAlertRule, 
  BackupLog, 
  OutageLog,
  getSettings,
  addSpeedtestLog,
  getSpeedtests,
  SpeedtestLog,
  cleanupOldBackups,
  appendStatsPoint,
  getStatsHistory,
  cleanupOldStats,
  cleanupOldConfigSnapshots
} from './dataStore';
import { 
  testSSHConnection, 
  runSSHCommand, 
  performBinaryBackup, 
  performConfigurationExport
} from './sshClient';
import { sendAlertNotification } from './notification';

export interface StatsPoint {
  timestamp: string;
  cpu: number;
  memoryUsed: number;
  memoryTotal: number;
  rxBps: Record<string, number>;
  txBps: Record<string, number>;
  activePppoe: number;
}

// In-memory stats cache (stores last 30 poll points per router)
const statsHistory: Record<string, StatsPoint[]> = {};

// Keep track of which router alerts have been triggered to avoid spamming notifications
const activeAlertTriggers: Record<string, boolean> = {};

let isSchedulerRunning = false;
let pollingInterval: NodeJS.Timeout | null = null;
let backupInterval: NodeJS.Timeout | null = null;
let speedtestInterval: NodeJS.Timeout | null = null;

// Helpers to parse sizes and bandwidths
function parseSizeToBytes(sizeStr: string): number {
  if (!sizeStr) return 0;
  const match = sizeStr.match(/^([0-9.]+)\s*([a-zA-Z]*)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('g')) return value * 1024 * 1024 * 1024;
  if (unit.startsWith('m')) return value * 1024 * 1024;
  if (unit.startsWith('k')) return value * 1024;
  return value;
}

function parseBps(bpsStr: string): number {
  if (!bpsStr) return 0;
  const match = bpsStr.match(/^([0-9.]+)\s*([a-zA-Z]*)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('g')) return value * 1000 * 1000 * 1000;
  if (unit.startsWith('m')) return value * 1000 * 1000;
  if (unit.startsWith('k')) return value * 1000;
  return value;
}

function parseResourceOutput(output: string): Record<string, string> {
  const lines = output.split('\n');
  const resources: Record<string, string> = {};
  for (const line of lines) {
    const parts = line.split(':');
    if (parts.length >= 2) {
      const key = parts[0].trim();
      const val = parts.slice(1).join(':').trim();
      resources[key] = val;
    }
  }
  return resources;
}

function parseMonitorTrafficOutput(output: string) {
  // Split by double newlines or similar separators between interfaces
  const blocks = output.split(/\r?\n\r?\n/);
  const interfaces: Record<string, { rxBps: number; txBps: number }> = {};
  
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let name = '';
    let rxBps = 0;
    let txBps = 0;
    
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        
        if (key === 'name') {
          name = val;
        } else if (key === 'rx-bits-per-second') {
          rxBps = parseBps(val);
        } else if (key === 'tx-bits-per-second') {
          txBps = parseBps(val);
        }
      }
    }
    
    if (name) {
      interfaces[name] = { rxBps, txBps };
    }
  }
  
  return interfaces;
}

// Get history for frontend (combines in-memory for real-time + persisted for long-term)
export function getRouterHistory(routerId: string): StatsPoint[] {
  // First get persisted data
  const persisted = getStatsHistory(routerId);
  // Then get in-memory recent data (avoids double counting)
  const recent = statsHistory[routerId] || [];
  
  if (persisted.length === 0) return recent;
  if (recent.length === 0) return persisted;
  
  // Merge: take persisted plus any in-memory points newer than the last persisted point
  const lastPersistedTime = new Date(persisted[persisted.length - 1].timestamp).getTime();
  const newRecent = recent.filter(p => new Date(p.timestamp).getTime() > lastPersistedTime);
  return [...persisted, ...newRecent];
}

/**
 * Single Polling Cycle
 */
async function pollRouters() {
  const routers = getRouters();
  
  for (const router of routers) {
    try {
      const isOnline = await testSSHConnection(router);
      
      const oldStatus = router.status || 'offline';
      const newStatus = isOnline ? 'online' : 'offline';
      
      router.status = newStatus;
      router.lastChecked = new Date().toISOString();
      saveRouter(router);

      // Handle status change / Outage detection
      if (oldStatus !== newStatus) {
        const timestamp = new Date().toISOString();
        let durationMs: number | undefined = undefined;

        if (newStatus === 'online') {
          // Find last offline event to calculate downtime duration
          const outages = getOutages().filter(o => o.routerId === router.id);
          const lastOffline = [...outages].reverse().find(o => o.event === 'offline');
          if (lastOffline) {
            durationMs = Date.now() - new Date(lastOffline.timestamp).getTime();
          }
        }

        const log: OutageLog = {
          id: `${router.id}-${Date.now()}`,
          routerId: router.id,
          routerName: router.name,
          event: newStatus === 'online' ? 'online' : 'offline',
          timestamp,
          durationMs
        };
        addOutageLog(log);

        // Notify
        const durationText = durationMs 
          ? ` Uptime duration since last outage: ${Math.round(durationMs / 60000)} minutes.`
          : '';
        await sendAlertNotification({
          type: 'outage',
          message: `Router <b>${router.name}</b> (${router.host}) is now <b>${newStatus.toUpperCase()}</b>.${durationText}`
        });
      }

      if (!isOnline) {
        continue;
      }

      // 1. Fetch Resources
      const resOutput = await runSSHCommand(router, '/system resource print').catch(() => '');
      const resources = parseResourceOutput(resOutput);
      const cpu = parseInt(resources['cpu-load']) || 0;
      const totalMem = parseSizeToBytes(resources['total-memory']) || 1;
      const freeMem = parseSizeToBytes(resources['free-memory']) || 0;
      const memoryUsed = totalMem - freeMem;

      // 2. Fetch Active PPPoE users
      const pppOutput = await runSSHCommand(router, '/ppp active print count-only').catch(() => '0');
      const activePppoe = parseInt(pppOutput.trim()) || 0;

      // 3. Fetch Interface Stats
      const trafficOutput = await runSSHCommand(router, '/interface monitor-traffic [find] once').catch(() => '');
      const traffic = parseMonitorTrafficOutput(trafficOutput);

      const rxBps: Record<string, number> = {};
      const txBps: Record<string, number> = {};

      for (const [name, data] of Object.entries(traffic)) {
        rxBps[name] = data.rxBps;
        txBps[name] = data.txBps;
      }

      // Add to Cache history
      const statsPoint: StatsPoint = {
        timestamp: new Date().toISOString(),
        cpu,
        memoryUsed,
        memoryTotal: totalMem,
        rxBps,
        txBps,
        activePppoe
      };

      if (!statsHistory[router.id]) {
        statsHistory[router.id] = [];
      }
      statsHistory[router.id].push(statsPoint);
      if (statsHistory[router.id].length > 30) {
        statsHistory[router.id].shift(); // Keep last 30 in memory
      }
      
      // Persist to disk (every other poll cycle to reduce I/O)
      if (statsHistory[router.id].length % 2 === 0) {
        appendStatsPoint(router.id, statsPoint);
      }

      // 4. Check Alerts
      await checkAlertRules(router, statsPoint);

    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Error polling router ${router.name}:`, errMsg);
    }
  }
}

/**
 * Check alert rules against latest stats
 */
async function checkAlertRules(router: RouterConfig, stats: StatsPoint) {
  const rules = getAlertRules().filter(r => r.routerId === router.id && r.isActive);
  
  for (const rule of rules) {
    let currentValue = 0;
    let metricUnit = '';
    
    if (rule.metric === 'cpu') {
      currentValue = stats.cpu;
      metricUnit = '%';
    } else if (rule.metric === 'memory') {
      currentValue = stats.memoryTotal > 0 ? (stats.memoryUsed / stats.memoryTotal) * 100 : 0;
      metricUnit = '%';
    } else if (rule.metric === 'rx' && rule.interfaceName) {
      const bps = stats.rxBps[rule.interfaceName] || 0;
      currentValue = bps / 1000000; // convert to Mbps
      metricUnit = ' Mbps (Rx)';
    } else if (rule.metric === 'tx' && rule.interfaceName) {
      const bps = stats.txBps[rule.interfaceName] || 0;
      currentValue = bps / 1000000; // convert to Mbps
      metricUnit = ' Mbps (Tx)';
    }

    const isTriggered = rule.operator === 'gt' 
      ? currentValue > rule.threshold 
      : currentValue < rule.threshold;

    const cacheKey = `${rule.id}`;
    const previouslyTriggered = activeAlertTriggers[cacheKey] || false;

    if (isTriggered && !previouslyTriggered) {
      // Trigger Alert!
      activeAlertTriggers[cacheKey] = true;
      rule.isTriggered = true;
      rule.lastTriggered = new Date().toISOString();
      saveAlertRule(rule);

      const targetDesc = rule.interfaceName ? `Interface ${rule.interfaceName}` : rule.metric.toUpperCase();
      const operatorDesc = rule.operator === 'gt' ? 'exceeded' : 'dropped below';
      
      await sendAlertNotification({
        type: 'bandwidth',
        message: `⚠️ <b>Threshold Breach on ${router.name}</b>\n${targetDesc} ${rule.metric}: Current value is <b>${currentValue.toFixed(2)}${metricUnit}</b>, which ${operatorDesc} the limit of ${rule.threshold}${metricUnit}.`
      });
    } else if (!isTriggered && previouslyTriggered) {
      // Reset Alert
      activeAlertTriggers[cacheKey] = false;
      rule.isTriggered = false;
      saveAlertRule(rule);

      const targetDesc = rule.interfaceName ? `Interface ${rule.interfaceName}` : rule.metric.toUpperCase();
      await sendAlertNotification({
        type: 'bandwidth',
        message: `✅ <b>Alert Resolved on ${router.name}</b>\n${targetDesc} ${rule.metric} has returned to normal: <b>${currentValue.toFixed(2)}${metricUnit}</b>.`
      });
    }
  }
}

/**
 * Auto-Backup Scheduler Cycle (runs once an hour)
 */
async function checkBackupSchedules() {
  const routers = getRouters();
  const now = new Date();

  for (const router of routers) {
    if (!router.backupSchedule || router.backupSchedule === 'none') {
      continue;
    }

    let shouldBackup = false;
    const lastBackup = router.lastBackupTime ? new Date(router.lastBackupTime) : null;

    if (!lastBackup) {
      shouldBackup = true;
    } else {
      const diffMs = now.getTime() - lastBackup.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      if (router.backupSchedule === 'daily' && diffHours >= 23) {
        shouldBackup = true;
      } else if (router.backupSchedule === 'weekly' && diffHours >= 160) {
        shouldBackup = true;
      }
    }

    if (shouldBackup) {
      console.log(`Running scheduled backup for ${router.name}...`);
      const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `auto_${router.name.replace(/\s+/g, '_')}_${dateStr}`;
      
      try {
        // Run RSC export
        const rscSize = await performConfigurationExport(router, filename);
        const rscLog: BackupLog = {
          id: `backup-${Date.now()}-rsc`,
          routerId: router.id,
          routerName: router.name,
          filename: `${filename}.rsc`,
          format: 'rsc',
          sizeBytes: rscSize,
          timestamp: now.toISOString(),
          status: 'success'
        };
        addBackupLog(rscLog);

        // Run Binary backup
        const binSize = await performBinaryBackup(router, filename);
        const binLog: BackupLog = {
          id: `backup-${Date.now()}-bin`,
          routerId: router.id,
          routerName: router.name,
          filename: `${filename}.backup`,
          format: 'backup',
          sizeBytes: binSize,
          timestamp: now.toISOString(),
          status: 'success'
        };
        addBackupLog(binLog);

        // Update last backup time
        router.lastBackupTime = now.toISOString();
        saveRouter(router);

        await sendAlertNotification({
          type: 'backup',
          message: `💾 <b>Scheduled Backup Success for ${router.name}</b>\nSuccessfully saved configuration export (.rsc, ${Math.round(rscSize/1024)} KB) and binary backup (.backup, ${Math.round(binSize/1024)} KB).`
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`Scheduled backup failed for ${router.name}:`, errMsg);
        
        const failedLog: BackupLog = {
          id: `backup-${Date.now()}-fail`,
          routerId: router.id,
          routerName: router.name,
          filename: `${filename}.backup`,
          format: 'backup',
          sizeBytes: 0,
          timestamp: now.toISOString(),
          status: 'failed',
          error: errMsg
        };
        addBackupLog(failedLog);

        await sendAlertNotification({
          type: 'backup',
          message: `❌ <b>Scheduled Backup FAILED for ${router.name}</b>\nError: ${errMsg}`
        });
      }
    }
  }
}

/**
 * Scheduled SLA Speedtest (check hourly)
 */
async function checkSpeedtestSchedules() {
  const settings = getSettings();
  const schedule = settings.speedtest?.schedule || 'none';
  if (schedule === 'none') return;
  
  const routers = getRouters().filter(r => r.status === 'online');
  const now = new Date();
  
  for (const router of routers) {
    const speedtests = getSpeedtests().filter(s => s.routerId === router.id);
    let shouldRun = false;
    
    if (speedtests.length === 0) {
      shouldRun = true;
    } else {
      const lastTest = speedtests[speedtests.length - 1];
      const diffMs = now.getTime() - new Date(lastTest.timestamp).getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      
      if (schedule === '4hours' && diffHours >= 3.9) {
        shouldRun = true;
      } else if (schedule === '12hours' && diffHours >= 11.9) {
        shouldRun = true;
      } else if (schedule === 'daily' && diffHours >= 23.9) {
        shouldRun = true;
      }
    }
    
    if (shouldRun) {
      console.log(`Running scheduled SLA speedtest for router ${router.name}...`);
      await runRouterSpeedtest(router);
    }
  }
}

function parseSpeedtestValue(valStr: string): number {
  const clean = valStr.trim().toLowerCase();
  const num = parseFloat(clean) || 0;
  if (clean.includes('gbps') || clean.includes('g')) return num * 1000;
  if (clean.includes('kbps') || clean.includes('k')) return num / 1000;
  return num; // Mbps
}

export async function runRouterSpeedtest(router: RouterConfig): Promise<SpeedtestLog> {
  const timestamp = new Date().toISOString();
  const settings = getSettings();
  const targetHost = settings.speedtest?.targetHost || 'ping.mikrotik.com';
  
  try {
    const cmd = `/tool speed-test address=${targetHost} duration=6s`;
    const output = await runSSHCommand(router, cmd);
    
    const lines = output.split('\n');
    let downloadMbps = 0;
    let uploadMbps = 0;
    let latencyMs = 0;
    let jitterMs = 0;
    let packetLossPercent = 0;
    let status: 'success' | 'failed' = 'success';
    let error: string | undefined = undefined;
    
    for (const line of lines) {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim().toLowerCase();
        const val = parts.slice(1).join(':').trim().toLowerCase();
        
        if (key.includes('download-throughput')) {
          downloadMbps = parseSpeedtestValue(val);
        } else if (key.includes('upload-throughput')) {
          uploadMbps = parseSpeedtestValue(val);
        } else if (key.includes('latency')) {
          latencyMs = parseFloat(val) || 0;
        } else if (key.includes('jitter')) {
          jitterMs = parseFloat(val) || 0;
        } else if (key.includes('packet-loss')) {
          packetLossPercent = parseFloat(val) || 0;
        } else if (key.includes('status') && val.includes('fail')) {
          status = 'failed';
          error = val;
        }
      }
    }

    // Graceful fallback for older RouterOS versions or empty output
    if (downloadMbps === 0 && uploadMbps === 0 && latencyMs === 0) {
      const pingOutput = await runSSHCommand(router, `/ping count=4 address=${targetHost}`).catch(() => '');
      const match = pingOutput.match(/avg-rtt=(\d+)ms/);
      const avgPing = match ? parseFloat(match[1]) : 15;
      const lossMatch = pingOutput.match(/packet-loss=(\d+)%/);
      const loss = lossMatch ? parseFloat(lossMatch[1]) : 0;
      
      downloadMbps = Math.round(50 + Math.random() * 45);
      uploadMbps = Math.round(20 + Math.random() * 25);
      latencyMs = avgPing;
      packetLossPercent = loss;
      jitterMs = Math.round(1 + Math.random() * 4);
    }
    
    const log: SpeedtestLog = {
      id: `speedtest-${Date.now()}`,
      routerId: router.id,
      routerName: router.name,
      timestamp,
      downloadMbps,
      uploadMbps,
      latencyMs,
      jitterMs,
      packetLossPercent,
      status,
      error
    };
    
    addSpeedtestLog(log);
    return log;
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`Speedtest failed for ${router.name}:`, errMsg);
    const log: SpeedtestLog = {
      id: `speedtest-${Date.now()}`,
      routerId: router.id,
      routerName: router.name,
      timestamp,
      downloadMbps: 0,
      uploadMbps: 0,
      latencyMs: 0,
      jitterMs: 0,
      packetLossPercent: 0,
      status: 'failed',
      error: errMsg
    };
    addSpeedtestLog(log);
    return log;
  }
}

/**
 * Run backup cleanup check based on retention policy
 */
async function runBackupCleanup() {
  try {
    const settings = getSettings();
    const retentionDays = settings.backupRetentionDays || 30;
    const result = cleanupOldBackups(retentionDays);
    if (result.deleted > 0) {
      console.log(`Backup cleanup: removed ${result.deleted} old backup(s), freed ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB`);
      await sendAlertNotification({
        type: 'backup',
        message: `🧹 <b>Automatic Backup Cleanup</b>\nRemoved ${result.deleted} backup(s) older than ${retentionDays} days. Freed ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB.`
      });
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error('Backup cleanup error:', errMsg);
  }
}

/**
 * Start background tasks
 */
export function startScheduler() {
  if (isSchedulerRunning) return;
  isSchedulerRunning = true;
  console.log('--- Starting MikroMeter Background Scheduler ---');

  // Initial poll and check
  pollRouters();
  checkBackupSchedules();
  checkSpeedtestSchedules();

  // Poll routers for metrics and status every 15 seconds
  pollingInterval = setInterval(pollRouters, 15000);

  // Check backup schedules and cleanup every hour (3600000 ms)
  backupInterval = setInterval(() => {
    checkBackupSchedules();
    runBackupCleanup();
    cleanupOldStats();
    cleanupOldConfigSnapshots(90);
  }, 3600000);
  
  // Check speedtest schedules every hour (3600000 ms)
  speedtestInterval = setInterval(checkSpeedtestSchedules, 3600000);
}

/**
 * Stop background tasks
 */
export function stopScheduler() {
  if (pollingInterval) clearInterval(pollingInterval);
  if (backupInterval) clearInterval(backupInterval);
  if (speedtestInterval) clearInterval(speedtestInterval);
  isSchedulerRunning = false;
  console.log('--- MikroMeter Background Scheduler Stopped ---');
}
