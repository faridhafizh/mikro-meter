import { NextResponse } from 'next/server';
import { sendTelegramNotification, sendWhatsappNotification } from '@/lib/notification';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, botToken, chatId, webhookUrl } = body;

    const testMessage = `🧪 <b>[MikroMeter Test]</b>\nThis is a test notification from your MikroMeter configuration panel! Connection is verified.`;

    if (type === 'telegram') {
      if (!botToken || !chatId) {
        return NextResponse.json({ error: 'Missing Telegram token or chatId' }, { status: 400 });
      }
      const success = await sendTelegramNotification(botToken, chatId, testMessage);
      return NextResponse.json({ success });
    } else if (type === 'whatsapp') {
      if (!webhookUrl) {
        return NextResponse.json({ error: 'Missing WhatsApp Webhook URL' }, { status: 400 });
      }
      // Strip html tags for whatsapp
      const cleanMessage = testMessage.replace(/<[^>]*>/g, '');
      const success = await sendWhatsappNotification(webhookUrl, cleanMessage);
      return NextResponse.json({ success });
    }

    return NextResponse.json({ error: 'Invalid notification type' }, { status: 400 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
