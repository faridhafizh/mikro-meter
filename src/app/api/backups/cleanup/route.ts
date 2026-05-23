import { NextResponse } from 'next/server';
import { getSettings, cleanupOldBackups } from '@/lib/dataStore';
import { sendAlertNotification } from '@/lib/notification';

export async function POST() {
  try {
    const settings = getSettings();
    const retentionDays = settings.backupRetentionDays || 30;

    const result = cleanupOldBackups(retentionDays);

    if (result.deleted > 0) {
      const freedMB = (result.freedBytes / (1024 * 1024)).toFixed(2);
      await sendAlertNotification({
        type: 'backup',
        message: `🧹 <b>Backup Cleanup Complete</b>\nDeleted ${result.deleted} old backup(s) older than ${retentionDays} days. Freed ${freedMB} MB of disk space.`
      });
    }

    return NextResponse.json({
      success: true,
      deleted: result.deleted,
      freedBytes: result.freedBytes,
      message: `Cleaned up ${result.deleted} backup(s). Freed ${(result.freedBytes / (1024 * 1024)).toFixed(2)} MB.`
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
