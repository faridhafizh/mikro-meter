import { NextResponse } from 'next/server';
import { getBackups, getRouters, addBackupLog, saveRouter } from '@/lib/dataStore';
import { performBinaryBackup, performConfigurationExport } from '@/lib/sshClient';
import { sendAlertNotification } from '@/lib/notification';

export async function GET() {
  const backups = getBackups();
  // Sort backups by timestamp descending
  const sorted = [...backups].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return NextResponse.json(sorted);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { routerId, format } = body; // format: 'rsc' | 'backup' | 'both'

    if (!routerId || !format) {
      return NextResponse.json({ error: 'Missing routerId or format' }, { status: 400 });
    }

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is currently offline. Cannot perform backup.' }, { status: 400 });
    }

    const timestampStr = new Date().toISOString();
    const dateStr = timestampStr.replace(/[:.]/g, '-').slice(0, 19);
    const baseFilename = `manual_${router.name.replace(/\s+/g, '_')}_${dateStr}`;
    const results: { format: string; filename: string; sizeBytes: number; timestamp: string; status: string; error?: string; routerId?: string; routerName?: string; id?: string }[] = [];

    // 1. Perform Plaintext RSC Export
    if (format === 'rsc' || format === 'both') {
      try {
        const size = await performConfigurationExport(router, baseFilename);
        const log = {
          id: `backup-${Date.now()}-rsc`,
          routerId: router.id,
          routerName: router.name,
          filename: `${baseFilename}.rsc`,
          format: 'rsc' as const,
          sizeBytes: size,
          timestamp: timestampStr,
          status: 'success' as const
        };
        addBackupLog(log);
        results.push(log);

        await sendAlertNotification({
          type: 'backup',
          message: `💾 <b>Manual Plaintext Backup Success</b> for ${router.name}: saved <code>${baseFilename}.rsc</code> (${Math.round(size/1024)} KB).`
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const log = {
          id: `backup-${Date.now()}-rsc-fail`,
          routerId: router.id,
          routerName: router.name,
          filename: `${baseFilename}.rsc`,
          format: 'rsc' as const,
          sizeBytes: 0,
          timestamp: timestampStr,
          status: 'failed' as const,
          error: errMsg
        };
        addBackupLog(log);
        results.push(log);

        await sendAlertNotification({
          type: 'backup',
          message: `❌ <b>Manual Plaintext Backup FAILED</b> for ${router.name}: ${errMsg}`
        });
      }
    }

    // 2. Perform Binary Backup
    if (format === 'backup' || format === 'both') {
      try {
        const size = await performBinaryBackup(router, baseFilename);
        const log = {
          id: `backup-${Date.now()}-bin`,
          routerId: router.id,
          routerName: router.name,
          filename: `${baseFilename}.backup`,
          format: 'backup' as const,
          sizeBytes: size,
          timestamp: timestampStr,
          status: 'success' as const
        };
        addBackupLog(log);
        results.push(log);

        await sendAlertNotification({
          type: 'backup',
          message: `💾 <b>Manual Binary Backup Success</b> for ${router.name}: saved <code>${baseFilename}.backup</code> (${Math.round(size/1024)} KB).`
        });
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const log = {
          id: `backup-${Date.now()}-bin-fail`,
          routerId: router.id,
          routerName: router.name,
          filename: `${baseFilename}.backup`,
          format: 'backup' as const,
          sizeBytes: 0,
          timestamp: timestampStr,
          status: 'failed' as const,
          error: errMsg
        };
        addBackupLog(log);
        results.push(log);

        await sendAlertNotification({
          type: 'backup',
          message: `❌ <b>Manual Binary Backup FAILED</b> for ${router.name}: ${errMsg}`
        });
      }
    }

    // Update last backup time on router config
    router.lastBackupTime = timestampStr;
    saveRouter(router);

    return NextResponse.json({ success: true, results });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
