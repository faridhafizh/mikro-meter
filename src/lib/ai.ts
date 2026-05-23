/**
 * MikroMeter AI Assistant Engine
 * Lightweight LLM-powered agent for natural language network management.
 * Supports OpenAI, Ollama, and custom OpenAI-compatible endpoints.
 */

import {
  getRouters, saveRouter, deleteRouter, RouterConfig,
  getSettings, saveSettings, AppSettings,
  getAlertRules, saveAlertRule, deleteAlertRule, AlertRule,
  getBackups,
  getOutages,
  getVouchers, saveVoucher, deleteVoucher, HotspotVoucher,
  getSpeedtests,
  AISettings,
} from './dataStore';
import { runSSHCommand, testSSHConnection, performBinaryBackup, performConfigurationExport } from './sshClient';
import { getRouterHistory, runRouterSpeedtest } from './scheduler';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIAction {
  name: string;
  description: string;
  parameters: Record<string, {
    type: string;
    description: string;
    required: boolean;
    enum?: string[];
    items?: { type: string };
  }>;
  handler: (params: Record<string, string | number | boolean | undefined>) => Promise<unknown>;
}

export interface LLMResponse {
  explanation: string;
  action: string | null;
  params: Record<string, string | number | boolean | undefined>;
  response: string;
}

export interface AIChatResult {
  message: string;
  actionExecuted?: {
    name: string;
    result: unknown;
  };
  error?: string;
}

// ──────────────────────────────────────────────
// Type-safe param accessors for handlers
// ──────────────────────────────────────────────

function pStr(v: string | number | boolean | undefined, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}
function pNum(v: string | number | boolean | undefined, fallback = 0): number {
  return typeof v === 'number' ? v : fallback;
}

// ──────────────────────────────────────────────
// Action Registry
// ──────────────────────────────────────────────

const actions: AIAction[] = [
  // ═══ Routers ═══
  {
    name: 'list_routers',
    description: 'List all registered routers with their status (online/offline), host, and port.',
    parameters: {},
    handler: async () => {
      const routers = getRouters();
      return routers.map(({ password, ...r }) => r);
    },
  },
  {
    name: 'get_router',
    description: 'Get detailed information about a specific router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to look up', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      const { password, ...safe } = router;
      return safe;
    },
  },
  {
    name: 'add_router',
    description: 'Add a new router to monitoring. Requires name, host, and username at minimum.',
    parameters: {
      name: { type: 'string', description: 'Display name for the router', required: true },
      host: { type: 'string', description: 'IP address or hostname', required: true },
      port: { type: 'number', description: 'SSH port (default 22)', required: false },
      username: { type: 'string', description: 'SSH username', required: true },
      password: { type: 'string', description: 'SSH password', required: true },
      latitude: { type: 'number', description: 'Latitude for map display', required: false },
      longitude: { type: 'number', description: 'Longitude for map display', required: false },
      backupSchedule: { type: 'string', description: 'Backup schedule: none, daily, weekly', required: false, enum: ['none', 'daily', 'weekly'] },
    },
    handler: async (params) => {
      const newRouter: RouterConfig = {
        id: `router-${Date.now()}`,
        name: pStr(params.name),
        host: pStr(params.host),
        port: pNum(params.port, 22),
        username: pStr(params.username),
        password: pStr(params.password),
        monitoredInterfaces: Array.isArray(params.monitoredInterfaces) ? params.monitoredInterfaces : [],
        backupSchedule: (pStr(params.backupSchedule) || 'none') as 'none' | 'daily' | 'weekly',
        status: 'offline',
        latitude: typeof params.latitude === 'number' ? params.latitude : undefined,
        longitude: typeof params.longitude === 'number' ? params.longitude : undefined,
      };

      const isConnected = await testSSHConnection(newRouter);
      if (!isConnected) {
        throw new Error('Could not establish SSH connection. Check credentials and host/port.');
      }

      newRouter.status = 'online';
      newRouter.lastChecked = new Date().toISOString();
      saveRouter(newRouter);
      return { id: newRouter.id, name: newRouter.name, host: newRouter.host, status: 'online' };
    },
  },
  {
    name: 'update_router',
    description: 'Update an existing router\'s configuration.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to update', required: true },
      name: { type: 'string', description: 'New display name', required: false },
      host: { type: 'string', description: 'New IP/hostname', required: false },
      port: { type: 'number', description: 'New SSH port', required: false },
      username: { type: 'string', description: 'New SSH username', required: false },
      password: { type: 'string', description: 'New SSH password', required: false },
      backupSchedule: { type: 'string', description: 'New backup schedule', required: false, enum: ['none', 'daily', 'weekly'] },
      latitude: { type: 'number', description: 'New latitude', required: false },
      longitude: { type: 'number', description: 'New longitude', required: false },
    },
    handler: async (params) => {
      const routers = getRouters();
      const existing = routers.find(r => r.id === pStr(params.routerId));
      if (!existing) throw new Error(`Router "${pStr(params.routerId)}" not found`);

      const updated: RouterConfig = {
        ...existing,
        name: pStr(params.name, existing.name),
        host: pStr(params.host, existing.host),
        port: typeof params.port === 'number' ? Math.round(params.port) : existing.port,
        username: pStr(params.username, existing.username),
        monitoredInterfaces: Array.isArray(params.monitoredInterfaces) ? params.monitoredInterfaces : existing.monitoredInterfaces,
        backupSchedule: (pStr(params.backupSchedule) || existing.backupSchedule) as 'none' | 'daily' | 'weekly',
        latitude: typeof params.latitude === 'number' ? params.latitude : existing.latitude,
        longitude: typeof params.longitude === 'number' ? params.longitude : existing.longitude,
      };
      if (params.password) updated.password = pStr(params.password);

      saveRouter(updated);
      return { id: updated.id, name: updated.name, status: updated.status };
    },
  },
  {
    name: 'delete_router',
    description: 'Remove a router from monitoring entirely.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to delete', required: true },
    },
    handler: async (params) => {
      const success = deleteRouter(pStr(params.routerId));
      if (!success) throw new Error(`Router "${pStr(params.routerId)}" not found or already deleted`);
      return { deleted: true, routerId: pStr(params.routerId) };
    },
  },
  {
    name: 'test_connection',
    description: 'Test SSH connectivity to a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to test', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      const result = await testSSHConnection(router);
      return { success: result, routerName: router.name, host: router.host };
    },
  },

  // ═══ SSH Commands ═══
  {
    name: 'run_command',
    description: 'Execute a RouterOS CLI command on a specific router and return the output.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to execute the command on', required: true },
      command: { type: 'string', description: 'The RouterOS command to run (e.g. /interface print, /system resource print)', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);
      const output = await runSSHCommand(router, pStr(params.command));
      return { output, routerName: router.name };
    },
  },

  // ═══ Speedtest ═══
  {
    name: 'run_speedtest',
    description: 'Run a latency/speedtest on a specific router to measure bandwidth and latency.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to run speedtest on', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);
      const result = await runRouterSpeedtest(router);
      return {
        downloadMbps: result.downloadMbps,
        uploadMbps: result.uploadMbps,
        latencyMs: result.latencyMs,
        jitterMs: result.jitterMs,
        packetLossPercent: result.packetLossPercent,
        routerName: router.name,
        status: result.status,
      };
    },
  },

  // ═══ Stats ═══
  {
    name: 'get_stats',
    description: 'Get latest performance statistics (CPU, memory, bandwidth) for a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to get stats for', required: true },
    },
    handler: async (params) => {
      const routerId = pStr(params.routerId);
      const routers = getRouters();
      const router = routers.find(r => r.id === routerId);
      if (!router) throw new Error(`Router "${routerId}" not found`);
      const history = getRouterHistory(routerId);
      const latest = history[history.length - 1] || null;
      return { routerName: router.name, latest, historyPoints: history.length };
    },
  },

  // ═══ Talkers / IP Management ═══
  {
    name: 'block_ip',
    description: 'Block an IP address on a specific router to prevent network access.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID', required: true },
      ip: { type: 'string', description: 'The IP address to block', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);

      // Ensure blocklist rule exists
      const checkRule = await runSSHCommand(router, '/ip firewall filter print where comment="Blocked by MikroMeter"').catch(() => '');
      if (!checkRule.includes('Blocked by MikroMeter')) {
        await runSSHCommand(router, '/ip firewall filter add chain=forward action=drop src-address-list=MikroMeter_Blocked comment="Blocked by MikroMeter" place-before=0').catch(() => {});
        await runSSHCommand(router, '/ip firewall filter add chain=forward action=drop dst-address-list=MikroMeter_Blocked comment="Blocked by MikroMeter" place-before=0').catch(() => {});
      }

      await runSSHCommand(router, `/ip firewall address-list add list=MikroMeter_Blocked address=${params.ip} comment="Blocked via AI"`);
      return { success: true, ip: params.ip, routerName: router.name, message: `IP ${params.ip} has been blocked on ${router.name}` };
    },
  },
  {
    name: 'unblock_ip',
    description: 'Unblock a previously blocked IP address on a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID', required: true },
      ip: { type: 'string', description: 'The IP address to unblock', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);

      await runSSHCommand(router, `/ip firewall address-list remove [find list=MikroMeter_Blocked address="${params.ip}"]`);
      return { success: true, ip: params.ip, routerName: router.name, message: `IP ${params.ip} has been unblocked on ${router.name}` };
    },
  },
  {
    name: 'make_dhcp_static',
    description: 'Convert a dynamic DHCP lease to a static binding on a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID', required: true },
      ip: { type: 'string', description: 'The IP address to make static', required: true },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);

      await runSSHCommand(router, `/ip dhcp-server lease make-static [find address="${params.ip}"]`);
      return { success: true, ip: params.ip, routerName: router.name, message: `DHCP lease for ${params.ip} made static on ${router.name}` };
    },
  },

  // ═══ Alerts ═══
  {
    name: 'list_alerts',
    description: 'List all configured alert rules.',
    parameters: {},
    handler: async () => getAlertRules(),
  },
  {
    name: 'add_alert',
    description: 'Create a new threshold alert rule for a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to monitor', required: true },
      metric: { type: 'string', description: 'Metric to monitor', required: true, enum: ['cpu', 'memory', 'rx', 'tx'] },
      operator: { type: 'string', description: 'Comparison operator', required: true, enum: ['gt', 'lt'] },
      threshold: { type: 'number', description: 'Threshold value (Mbps for traffic, % for cpu/memory)', required: true },
      interfaceName: { type: 'string', description: 'Interface name (required for rx/tx metrics)', required: false },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);

      const rule: AlertRule = {
        id: `rule-${Date.now()}`,
        routerId: pStr(params.routerId),
        routerName: router.name,
        interfaceName: pStr(params.interfaceName),
        metric: pStr(params.metric) as 'cpu' | 'memory' | 'rx' | 'tx',
        operator: pStr(params.operator) as 'gt' | 'lt',
        threshold: pNum(params.threshold),
        isActive: true,
      };
      saveAlertRule(rule);
      return rule;
    },
  },
  {
    name: 'delete_alert',
    description: 'Remove an alert rule by its ID.',
    parameters: {
      alertId: { type: 'string', description: 'The alert rule ID to delete', required: true },
    },
    handler: async (params) => {
      const alertId = pStr(params.alertId);
      const success = deleteAlertRule(alertId);
      if (!success) throw new Error(`Alert rule "${alertId}" not found`);
      return { deleted: true, alertId };
    },
  },

  // ═══ Backups ═══
  {
    name: 'list_backups',
    description: 'List all backup logs with timestamps, sizes, and status.',
    parameters: {},
    handler: async () => {
      const backups = getBackups();
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 50);
    },
  },
  {
    name: 'create_backup',
    description: 'Trigger a manual backup (RSC export, binary backup, or both) for a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to back up', required: true },
      format: { type: 'string', description: 'Backup format', required: true, enum: ['rsc', 'backup', 'both'] },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);

      const timestampStr = new Date().toISOString();
      const dateStr = timestampStr.replace(/[:.]/g, '-').slice(0, 19);
      const baseFilename = `ai_${router.name.replace(/\s+/g, '_')}_${dateStr}`;
      const results: { format: string; filename: string; sizeBytes: number; status: string }[] = [];

      if (params.format === 'rsc' || params.format === 'both') {
        const size = await performConfigurationExport(router, baseFilename);
        results.push({ format: 'rsc', filename: `${baseFilename}.rsc`, sizeBytes: size, status: 'success' });
      }
      if (params.format === 'backup' || params.format === 'both') {
        const size = await performBinaryBackup(router, baseFilename);
        results.push({ format: 'backup', filename: `${baseFilename}.backup`, sizeBytes: size, status: 'success' });
      }

      return { success: true, routerName: router.name, results };
    },
  },

  // ═══ Settings ═══
  {
    name: 'get_settings',
    description: 'View current application settings including notification configs, speedtest schedule, and AI settings.',
    parameters: {},
    handler: async () => {
      const settings = getSettings();
      // Mask sensitive fields
      return {
        ...settings,
        telegram: { ...settings.telegram, botToken: settings.telegram.botToken ? '***' : '', chatId: settings.telegram.chatId ? '***' : '' },
        whatsapp: { ...settings.whatsapp, webhookUrl: settings.whatsapp.webhookUrl ? '***' : '' },
        ai: { ...settings.ai, apiKey: settings.ai?.apiKey ? '***' : '' },
      };
    },
  },
  {
    name: 'update_settings',
    description: 'Update application settings. Only provide the fields you want to change.',
    parameters: {
      telegram_enabled: { type: 'boolean', description: 'Enable/disable Telegram notifications', required: false },
      telegram_botToken: { type: 'string', description: 'Telegram bot token', required: false },
      telegram_chatId: { type: 'string', description: 'Telegram chat ID', required: false },
      whatsapp_enabled: { type: 'boolean', description: 'Enable/disable WhatsApp notifications', required: false },
      whatsapp_webhookUrl: { type: 'string', description: 'WhatsApp webhook URL', required: false },
      speedtest_schedule: { type: 'string', description: 'Speedtest schedule frequency', required: false, enum: ['none', '4hours', '12hours', 'daily'] },
      backupRetentionDays: { type: 'number', description: 'Days to keep backups before auto-cleanup', required: false },
      ai_enabled: { type: 'boolean', description: 'Enable or disable the AI assistant', required: false },
      ai_provider: { type: 'string', description: 'AI provider: openai, ollama, or custom', required: false, enum: ['openai', 'ollama', 'custom'] },
      ai_apiUrl: { type: 'string', description: 'AI API URL (for Ollama or custom endpoints)', required: false },
      ai_model: { type: 'string', description: 'AI model name (e.g. gpt-4o-mini, llama3)', required: false },
    },
    handler: async (params) => {
      const current = getSettings();
      const updated: AppSettings = {
        telegram: {
          enabled: typeof params.telegram_enabled === 'boolean' ? params.telegram_enabled : current.telegram.enabled,
          botToken: pStr(params.telegram_botToken, current.telegram.botToken),
          chatId: pStr(params.telegram_chatId, current.telegram.chatId),
          alertOnOutage: current.telegram.alertOnOutage,
          alertOnBandwidth: current.telegram.alertOnBandwidth,
          alertOnBackup: current.telegram.alertOnBackup,
        },
        whatsapp: {
          enabled: typeof params.whatsapp_enabled === 'boolean' ? params.whatsapp_enabled : current.whatsapp.enabled,
          webhookUrl: pStr(params.whatsapp_webhookUrl, current.whatsapp.webhookUrl),
          alertOnOutage: current.whatsapp.alertOnOutage,
          alertOnBandwidth: current.whatsapp.alertOnBandwidth,
          alertOnBackup: current.whatsapp.alertOnBackup,
        },
        speedtest: current.speedtest,
        backupRetentionDays: typeof params.backupRetentionDays === 'number' ? params.backupRetentionDays : (current.backupRetentionDays ?? 30),
        ai: {
          enabled: typeof params.ai_enabled === 'boolean' ? params.ai_enabled : (current.ai?.enabled ?? false),
          provider: (pStr(params.ai_provider) || current.ai?.provider || 'openai') as 'openai' | 'ollama' | 'custom',
          apiUrl: pStr(params.ai_apiUrl, current.ai?.apiUrl ?? ''),
          apiKey: current.ai?.apiKey ?? '',
          model: pStr(params.ai_model, current.ai?.model ?? 'gpt-4o-mini'),
          maxTokens: current.ai?.maxTokens ?? 1024,
          temperature: current.ai?.temperature ?? 0.3,
        },
      };
      if (pStr(params.speedtest_schedule)) {
        updated.speedtest.schedule = pStr(params.speedtest_schedule) as 'none' | '4hours' | '12hours' | 'daily';
      }
      saveSettings(updated);
      return { success: true, message: 'Settings updated successfully' };
    },
  },

  // ═══ Vouchers ═══
  {
    name: 'list_vouchers',
    description: 'List all hotspot voucher codes.',
    parameters: {},
    handler: async () => getVouchers(),
  },
  {
    name: 'create_voucher',
    description: 'Create a new hotspot voucher on a router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID to create the voucher on', required: true },
      profile: { type: 'string', description: 'Hotspot profile name (e.g. default, 3mbps)', required: false },
      limitUptime: { type: 'string', description: 'Time limit (e.g. 1d, 12h, 30m)', required: false },
      limitBytes: { type: 'number', description: 'Data limit in bytes', required: false },
      code: { type: 'string', description: 'Custom voucher code (optional, auto-generated if omitted)', required: false },
    },
    handler: async (params) => {
      const routers = getRouters();
      const router = routers.find(r => r.id === params.routerId);
      if (!router) throw new Error(`Router "${params.routerId}" not found`);
      if (router.status !== 'online') throw new Error(`Router "${router.name}" is offline`);

      const voucherCode = typeof params.code === 'string'
        ? params.code.toUpperCase().trim()
        : `AI-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;

      let cmd = `/ip hotspot user add name="${voucherCode}" password="${voucherCode}"`;
      if (pStr(params.profile)) cmd += ` profile="${pStr(params.profile)}"`;
      if (pStr(params.limitUptime)) cmd += ` limit-uptime="${pStr(params.limitUptime)}"`;
      if (params.limitBytes && Number(params.limitBytes) > 0) cmd += ` limit-bytes-total=${Number(params.limitBytes)}`;
      cmd += ` comment="MikroMeter-AI-Voucher"`;

      await runSSHCommand(router, cmd);

      const voucher: HotspotVoucher = {
        id: `voucher-${Date.now()}`,
        routerId: router.id,
        routerName: router.name,
        username: voucherCode,
        password: voucherCode,
        profile: pStr(params.profile, 'default'),
        limitUptime: pStr(params.limitUptime) || undefined,
        limitBytes: pNum(params.limitBytes) || undefined,
        timestamp: new Date().toISOString(),
        status: 'active',
      };
      saveVoucher(voucher);
      return { voucherCode, routerName: router.name, profile: pStr(params.profile, 'default') };
    },
  },
  {
    name: 'delete_voucher',
    description: 'Delete a voucher record from local storage.',
    parameters: {
      voucherId: { type: 'string', description: 'The voucher ID to delete', required: true },
    },
    handler: async (params) => {
      const success = deleteVoucher(pStr(params.voucherId));
      if (!success) throw new Error(`Voucher "${pStr(params.voucherId)}" not found`);
      return { deleted: true, voucherId: pStr(params.voucherId) };
    },
  },

  // ═══ Info / Misc ═══
  {
    name: 'get_outages',
    description: 'Get outage history sorted by most recent first.',
    parameters: {
      limit: { type: 'number', description: 'Maximum number of recent outages to return (default 20)', required: false },
    },
    handler: async (params) => {
      const outages = getOutages();
      return outages
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, pNum(params.limit, 20));
    },
  },
  {
    name: 'get_speedtests',
    description: 'Get speedtest history for a specific router.',
    parameters: {
      routerId: { type: 'string', description: 'The router ID (optional, omit for all routers)', required: false },
      limit: { type: 'number', description: 'Max results (default 10)', required: false },
    },
    handler: async (params) => {
      let logs = getSpeedtests();
      const routerId = pStr(params.routerId);
      const limit = pNum(params.limit, 10);
      if (routerId) logs = logs.filter(l => l.routerId === routerId);
      return logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    },
  },
];

// ──────────────────────────────────────────────
// System Prompt
// ──────────────────────────────────────────────

function buildSystemPrompt(): string {
  const actionDescriptions = actions.map(a => {
    const paramsStr = Object.entries(a.parameters).map(([key, p]) => {
      const req = p.required ? 'required' : 'optional';
      const enums = p.enum ? ` (values: ${p.enum.join(', ')})` : '';
      return `  - ${key}: ${p.type} (${req})${enums} — ${p.description}`;
    }).join('\n');

    return `## ${a.name}
${a.description}
Parameters:
${paramsStr || '  None'}`;
  }).join('\n\n');

  return `You are the MikroMeter AI Assistant — an intelligent network management agent embedded in a MikroTik monitoring dashboard.

Your purpose is to help network administrators manage their routers, configurations, alerts, backups, and more through natural language conversation.

## Available Actions

You can execute the following actions by responding with a JSON block. When the user asks you to do something, choose the appropriate action and provide the required parameters.

${actionDescriptions}

## Response Format

You MUST respond with ONLY a valid JSON object (no markdown, no code fences, no extra text):

{
  "explanation": "Brief reasoning about what the user wants",
  "action": "action_name or null if just conversing",
  "params": { ... parameters for the action ... },
  "response": "Your friendly, professional response to the user"
}

Rules:
1. If the user is just asking a question or having a conversation (not requesting an action), set action to null.
2. If the user wants you to perform an action, pick the BEST matching action and provide ALL required params. If a required param is missing, ask the user for it in the response and set action to null.
3. Always be concise and helpful. Use technical accuracy when discussing network concepts.
4. When listing data, format it clearly. For routers, mention name, IP, and status.
5. You can call multiple actions sequentially by responding with one action at a time.
6. The system has JSON file storage for configuration data. SSH connection is required for live router operations.
7. If an action fails, explain the error clearly and suggest alternatives.
8. Available router IDs can be found by using the list_routers action.
9. When the user says "block an IP" they mean add it to the firewall blocklist on a MikroTik router.`;
}

// ──────────────────────────────────────────────
// LLM Integration
// ──────────────────────────────────────────────

function ensureChatUrl(baseUrl: string, defaultUrl: string): string {
  if (!baseUrl) return defaultUrl;
  // If the URL already ends with /chat/completions, use as-is
  if (baseUrl.includes('/chat/completions')) return baseUrl;
  // If it ends with a slash, append v1/chat/completions
  if (baseUrl.endsWith('/v1') || baseUrl.endsWith('/v1/')) return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  if (baseUrl.endsWith('/')) return `${baseUrl}v1/chat/completions`;
  // Append the path
  if (baseUrl.includes('/v1')) return `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  return `${baseUrl}/v1/chat/completions`;
}

function getApiConfig(aiSettings: AISettings): { url: string; headers: Record<string, string>; model: string } {
  let url: string;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  switch (aiSettings.provider) {
    case 'openai':
      url = ensureChatUrl(aiSettings.apiUrl, 'https://api.openai.com/v1/chat/completions');
      headers['Authorization'] = `Bearer ${aiSettings.apiKey}`;
      break;
    case 'ollama':
      url = ensureChatUrl(aiSettings.apiUrl, 'http://localhost:11434/v1/chat/completions');
      break;
    case 'custom':
    default:
      url = ensureChatUrl(aiSettings.apiUrl, '');
      if (aiSettings.apiKey) {
        headers['Authorization'] = `Bearer ${aiSettings.apiKey}`;
      }
      break;
  }

  return {
    url,
    headers,
    model: aiSettings.model || 'gpt-4o-mini',
  };
}

function extractJSON(text: string): LLMResponse | null {
  // Try parsing the whole text as JSON first
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed.explanation && parsed.response) return parsed;
  } catch {}

  // Try extracting JSON from markdown code blocks
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1].trim());
      if (parsed.explanation && parsed.response) return parsed;
    } catch {}
  }

  // Try finding any JSON-like structure
  const jsonMatch = text.match(/\{[\s\S]*"explanation"[\s\S]*"response"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      if (parsed.explanation && parsed.response) return parsed;
    } catch {}
  }

  return null;
}

// ──────────────────────────────────────────────
// Main AI Chat Handler
// ──────────────────────────────────────────────

export async function processAIChat(
  userMessage: string,
  conversationHistory: ChatMessage[],
  aiSettings: AISettings,
): Promise<AIChatResult> {
  if (!aiSettings.enabled) {
    return { message: 'AI assistant is not enabled. Please configure and enable AI in Settings first.' };
  }

  if (!aiSettings.apiKey && aiSettings.provider === 'openai') {
    return { message: 'AI assistant needs an API key. Please configure it in Settings → AI Assistant.' };
  }

  if (!aiSettings.apiUrl && aiSettings.provider === 'custom') {
    return { message: 'AI assistant needs a custom API URL. Please configure it in Settings → AI Assistant.' };
  }

  const systemPrompt = buildSystemPrompt();
  const config = getApiConfig(aiSettings);

  // Build messages: system + conversation history + user's new message
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.slice(-20), // Keep last 20 messages for context
    { role: 'user', content: userMessage },
  ];

  try {
    // Call the LLM
    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages,
        max_tokens: aiSettings.maxTokens || 1024,
        temperature: aiSettings.temperature ?? 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      throw new Error(`LLM API error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    const llmText = data.choices?.[0]?.message?.content;
    if (!llmText) {
      throw new Error('LLM returned an empty response');
    }

    // Parse the structured response
    const parsed = extractJSON(llmText);
    if (!parsed) {
      // If the LLM didn't return valid JSON, just return its text as a conversational response
      return { message: llmText };
    }

    // If no action requested, just return the response text
    if (!parsed.action) {
      return { message: parsed.response };
    }

    // Find and execute the action
    const actionDef = actions.find(a => a.name === parsed.action);
    if (!actionDef) {
      return {
        message: `I tried to use "${parsed.action}" but that action isn't available. ${parsed.response}`,
      };
    }

    // Validate required parameters
    const missingParams: string[] = [];
    for (const [key, param] of Object.entries(actionDef.parameters)) {
      if (param.required && (parsed.params[key] === undefined || parsed.params[key] === null || parsed.params[key] === '')) {
        missingParams.push(key);
      }
    }

    if (missingParams.length > 0) {
      return {
        message: `I need more information to ${actionDef.description.toLowerCase()}. Missing: ${missingParams.join(', ')}. ${parsed.response}`,
      };
    }

    // Execute the action
    const result = await actionDef.handler(parsed.params);
    return {
      message: parsed.response,
      actionExecuted: {
        name: parsed.action,
        result,
      },
    };

  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return {
      message: `I encountered an error: ${errMsg}`,
      error: errMsg,
    };
  }
}

// ──────────────────────────────────────────────
// Validation
// ──────────────────────────────────────────────

export async function testAIConnection(aiSettings: AISettings): Promise<{ success: boolean; message: string }> {
  try {
    const config = getApiConfig(aiSettings);
    const response = await fetch(config.url, {
      method: 'POST',
      headers: config.headers,
      body: JSON.stringify({
        model: config.model,
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => 'Unknown error');
      return { success: false, message: `API error (${response.status}): ${errText}` };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    return { success: true, message: `Connected! Model responded: "${content?.trim() || 'empty'}"` };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    return { success: false, message: `Connection failed: ${errMsg}` };
  }
}
