import { NextResponse } from 'next/server';
import { getConfigSnapshots, getRouters, addConfigSnapshot, deleteConfigSnapshot, ConfigSnapshot } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const routerId = searchParams.get('routerId') || undefined;
  const snapshots = getConfigSnapshots(routerId);
  return NextResponse.json(snapshots);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { routerId, label } = body;

    if (!routerId) {
      return NextResponse.json({ error: 'Missing routerId' }, { status: 400 });
    }

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is offline' }, { status: 400 });
    }

    // Fetch current config from the router
    const configContent = await runSSHCommand(router, '/export terse show-sensitive');

    if (!configContent.trim()) {
      return NextResponse.json({ error: 'Empty config returned from router' }, { status: 500 });
    }

    const snapshot: ConfigSnapshot = {
      id: `snapshot-${Date.now()}`,
      routerId: router.id,
      routerName: router.name,
      timestamp: new Date().toISOString(),
      content: configContent,
      label: label || `Manual snapshot - ${new Date().toLocaleString()}`,
      filename: `config_${router.name.replace(/\\s+/g, '_')}_${Date.now()}.rsc`,
    };

    addConfigSnapshot(snapshot);

    return NextResponse.json({ success: true, snapshot: { ...snapshot, content: snapshot.content.slice(0, 200) + '...' } });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Missing snapshot id' }, { status: 400 });
  }

  const success = deleteConfigSnapshot(id);
  if (!success) {
    return NextResponse.json({ error: 'Snapshot not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
