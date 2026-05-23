import { NextResponse } from 'next/server';
import { getSettings, saveSettings } from '@/lib/dataStore';
import { testAIConnection } from '@/lib/ai';

export async function GET() {
  const settings = getSettings();
  // Mask the API key
  const ai = settings.ai ? {
    ...settings.ai,
    apiKey: settings.ai.apiKey ? '***' : '',
  } : undefined;
  return NextResponse.json({ ai });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { enabled, provider, apiUrl, apiKey, model, maxTokens, temperature, testOnly } = body;

    const current = getSettings();

    if (testOnly) {
      // Test connection without saving
      const testSettings = {
        enabled: enabled ?? current.ai?.enabled ?? false,
        provider: provider ?? current.ai?.provider ?? 'openai',
        apiUrl: apiUrl ?? current.ai?.apiUrl ?? '',
        apiKey: apiKey ?? current.ai?.apiKey ?? '',
        model: model ?? current.ai?.model ?? 'gpt-4o-mini',
        maxTokens: maxTokens ?? current.ai?.maxTokens ?? 1024,
        temperature: temperature ?? current.ai?.temperature ?? 0.3,
      };
      const result = await testAIConnection(testSettings);
      return NextResponse.json(result);
    }

    // Save AI settings
    // Protect against sending back the masked value '***' — treat it as 'no change'
    const resolvedApiKey = 
      apiKey === undefined || apiKey === '***' 
        ? current.ai?.apiKey ?? '' 
        : apiKey;

    const newSettings = {
      ...current,
      ai: {
        enabled: enabled ?? current.ai?.enabled ?? false,
        provider: provider ?? current.ai?.provider ?? 'openai',
        apiUrl: apiUrl ?? current.ai?.apiUrl ?? '',
        apiKey: resolvedApiKey,
        model: model ?? current.ai?.model ?? 'gpt-4o-mini',
        maxTokens: maxTokens ?? current.ai?.maxTokens ?? 1024,
        temperature: temperature ?? current.ai?.temperature ?? 0.3,
      },
    };

    saveSettings(newSettings);

    // Return masked key
    const safe = {
      ...newSettings.ai,
      apiKey: newSettings.ai.apiKey ? '***' : '',
    };

    return NextResponse.json({ ai: safe, success: true });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
