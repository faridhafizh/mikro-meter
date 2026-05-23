import { NextResponse } from 'next/server';
import { testSSHConnection } from '@/lib/sshClient';
import { RouterConfig } from '@/lib/dataStore';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { host, port, username, password } = body;

    if (!host || !username) {
      return NextResponse.json({ error: 'Missing host or username' }, { status: 400 });
    }

    const mockRouter: RouterConfig = {
      id: 'test',
      name: 'Test Router',
      host,
      port: Number(port) || 22,
      username,
      password: password || '',
    };

    const isConnected = await testSSHConnection(mockRouter);
    return NextResponse.json({ success: isConnected });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
