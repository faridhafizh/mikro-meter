import { NextResponse } from 'next/server';
import { getRouters, saveRouter, deleteRouter, RouterConfig } from '@/lib/dataStore';
import { testSSHConnection } from '@/lib/sshClient';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const routers = getRouters();
  const router = routers.find(r => r.id === id);

  if (!router) {
    return NextResponse.json({ error: 'Router not found' }, { status: 44 });
  }

  const { password: _pw, ...safeRouter } = router;
  return NextResponse.json(safeRouter);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const routers = getRouters();
    const existing = routers.find(r => r.id === id);

    if (!existing) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const { name, host, port, username, password, monitoredInterfaces, backupSchedule, latitude, longitude } = body;

    const updatedRouter: RouterConfig = {
      ...existing,
      name: name || existing.name,
      host: host || existing.host,
      port: port !== undefined ? Number(port) : existing.port,
      username: username || existing.username,
      monitoredInterfaces: monitoredInterfaces !== undefined ? monitoredInterfaces : existing.monitoredInterfaces,
      backupSchedule: backupSchedule || existing.backupSchedule,
      latitude: latitude !== undefined ? Number(latitude) : existing.latitude,
      longitude: longitude !== undefined ? Number(longitude) : existing.longitude,
    };

    if (password) {
      updatedRouter.password = password;
    }

    // Verify connection if host/port/user/pass was changed
    const connectionInfoChanged = 
      host !== existing.host || 
      port !== existing.port || 
      username !== existing.username || 
      (password !== undefined && password !== '');

    if (connectionInfoChanged) {
      const isConnected = await testSSHConnection(updatedRouter);
      if (!isConnected) {
        return NextResponse.json({ error: 'Could not establish SSH connection with updated details. Details not saved.' }, { status: 400 });
      }
      updatedRouter.status = 'online';
      updatedRouter.lastChecked = new Date().toISOString();
    }

    saveRouter(updatedRouter);

    const { password: _, ...safeRouter } = updatedRouter;
    return NextResponse.json(safeRouter);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = deleteRouter(id);
  if (!success) {
    return NextResponse.json({ error: 'Router not found or could not be deleted' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
