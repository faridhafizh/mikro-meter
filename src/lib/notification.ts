import { getSettings } from './dataStore';

interface NotificationPayload {
  message: string;
  type: 'outage' | 'bandwidth' | 'backup';
}

export async function sendTelegramNotification(token: string, chatId: string, text: string): Promise<boolean> {
  if (!token || !chatId) return false;
  
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
      }),
    });
    
    if (!res.ok) {
      const errText = await res.text();
      console.error(`Telegram API error: ${errText}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending Telegram notification:', error);
    return false;
  }
}

export async function sendWhatsappNotification(webhookUrl: string, text: string): Promise<boolean> {
  if (!webhookUrl) return false;
  
  try {
    // Send standard POST request with message body
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        text: text,
        timestamp: new Date().toISOString(),
      }),
    });
    
    if (!res.ok) {
      console.error(`WhatsApp Webhook API error. Status: ${res.status}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error sending WhatsApp notification:', error);
    return false;
  }
}

export async function sendAlertNotification(payload: NotificationPayload): Promise<void> {
  const settings = getSettings();
  const text = `🔔 <b>[MikroMeter Alert]</b>\n\n${payload.message}`;

  // Send Telegram if enabled
  if (settings.telegram.enabled) {
    let shouldSend = false;
    if (payload.type === 'outage' && settings.telegram.alertOnOutage) shouldSend = true;
    if (payload.type === 'bandwidth' && settings.telegram.alertOnBandwidth) shouldSend = true;
    if (payload.type === 'backup' && settings.telegram.alertOnBackup) shouldSend = true;

    if (shouldSend) {
      await sendTelegramNotification(
        settings.telegram.botToken,
        settings.telegram.chatId,
        text
      );
    }
  }

  // Send WhatsApp if enabled
  if (settings.whatsapp.enabled) {
    let shouldSend = false;
    if (payload.type === 'outage' && settings.whatsapp.alertOnOutage) shouldSend = true;
    if (payload.type === 'bandwidth' && settings.whatsapp.alertOnBandwidth) shouldSend = true;
    if (payload.type === 'backup' && settings.whatsapp.alertOnBackup) shouldSend = true;

    if (shouldSend) {
      await sendWhatsappNotification(
        settings.whatsapp.webhookUrl,
        // Plain text for WhatsApp
        text.replace(/<[^>]*>/g, '') 
      );
    }
  }
}
