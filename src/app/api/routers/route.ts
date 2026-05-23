import { NextResponse } from 'next/server';
import { getRouters, saveRouter, RouterConfig } from '@/lib/dataStore';
import { testSSHConnection } from '@/lib/sshClient';

export async function GET() {
  const routers = getRouters();
  const safeRouters = routers.map(r => {
    const { password, ...rest } = r;
    return rest;
  });
  return NextResponse.json(safeRouters);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, host, port, username, password, monitoredInterfaces, backupSchedule, latitude, longitude } = body;

    if (!name || !host || !username) {
      return NextResponse.json({ error: 'Missing required fields: name, host, username' }, { status: 400 });
    }

    const newRouter: RouterConfig = {
      id: `router-${Date.now()}`,
      name,
      host,
      port: Number(port) || 22,
      username,
      password: password || '',
      monitoredInterfaces: monitoredInterfaces || [],
      backupSchedule: backupSchedule || 'none',
      status: 'offline',
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
    };

    // Verify connection first
    const isConnected = await testSSHConnection(newRouter);
    if (!isConnected) {
      return NextResponse.json({ error: 'Could not establish SSH connection to the router. Please check your credentials and host/port.' }, { status: 400 });
    }

    newRouter.status = 'online';
    newRouter.lastChecked = new Date().toISOString();
    saveRouter(newRouter);

    const { password: _, ...safeRouter } = newRouter;
    return NextResponse.json(safeRouter, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
