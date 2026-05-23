import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/dataStore';
import { processAIChat, ChatMessage } from '@/lib/ai';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const settings = getSettings();
    if (!settings.ai || !settings.ai.enabled) {
      return NextResponse.json({
        message: '⚠️ AI Assistant is not enabled. Go to **Settings → AI Assistant** to configure and enable it.',
      });
    }

    // Sanitize history — keep last 20 messages for context
    const safeHistory: ChatMessage[] = Array.isArray(history)
      ? history.filter((m: {role?: string; content?: string}) => m.role && m.content).slice(-20)
      : [];

    const result = await processAIChat(message.trim(), safeHistory, settings.ai);

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('AI Chat Error:', error);
    return NextResponse.json({
      message: `❌ Internal error: ${errorMessage}`,
      error: errorMessage,
    }, { status: 500 });
  }
}
