import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/dataStore';
// Notifications are sent through ../lib/notification when settings are updated

export async function GET() {
  const settings = getSettings();
  return NextResponse.json(settings);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { telegram, whatsapp, speedtest, ai } = body;

    const current = getSettings();

    const newSettings = {
      telegram: {
        enabled: telegram?.enabled ?? current.telegram.enabled,
        botToken: telegram?.botToken ?? current.telegram.botToken,
        chatId: telegram?.chatId ?? current.telegram.chatId,
        alertOnOutage: telegram?.alertOnOutage ?? current.telegram.alertOnOutage,
        alertOnBandwidth: telegram?.alertOnBandwidth ?? current.telegram.alertOnBandwidth,
        alertOnBackup: telegram?.alertOnBackup ?? current.telegram.alertOnBackup,
      },
      whatsapp: {
        enabled: whatsapp?.enabled ?? current.whatsapp.enabled,
        webhookUrl: whatsapp?.webhookUrl ?? current.whatsapp.webhookUrl,
        alertOnOutage: whatsapp?.alertOnOutage ?? current.whatsapp.alertOnOutage,
        alertOnBandwidth: whatsapp?.alertOnBandwidth ?? current.whatsapp.alertOnBandwidth,
        alertOnBackup: whatsapp?.alertOnBackup ?? current.whatsapp.alertOnBackup,
      },
      speedtest: {
        schedule: speedtest?.schedule ?? current.speedtest?.schedule ?? 'none',
        targetHost: speedtest?.targetHost ?? current.speedtest?.targetHost ?? 'ping.mikrotik.com',
      },
      backupRetentionDays: body.backupRetentionDays ?? current.backupRetentionDays ?? 30,
      ai: ai ?? current.ai ?? {
        enabled: false,
        provider: 'openai',
        apiUrl: '',
        apiKey: '',
        model: 'gpt-4o-mini',
        maxTokens: 1024,
        temperature: 0.3,
      }
    };

    saveSettings(newSettings);
    return NextResponse.json(newSettings);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
