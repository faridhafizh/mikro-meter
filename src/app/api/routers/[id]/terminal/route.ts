import { NextResponse } from 'next/server';
import { getRouters } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routerId } = await params;
    const body = await request.json();
    const { command } = body;

    if (!command || command.trim() === '') {
      return NextResponse.json({ error: 'Command cannot be empty' }, { status: 400 });
    }

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is offline, terminal connection unavailable.' }, { status: 400 });
    }

    console.log(`CLI Console executing: "${command}" on ${router.name}`);
    
    try {
      const output = await runSSHCommand(router, command);
      return NextResponse.json({ output: output || '\r\n' });
    } catch (cmdErr: unknown) {
      // In case of command failure, return the exact error description so xterm/cli can output it
      const cmdErrMsg = cmdErr instanceof Error ? cmdErr.message : String(cmdErr);
      return NextResponse.json({ 
        output: `\x1b[31mError: ${cmdErrMsg}\x1b[0m\r\n` 
      }, { status: 200 }); // Still return 200 so the client displays the error message inline inside the console
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
