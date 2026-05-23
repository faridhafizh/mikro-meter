import { NextResponse } from 'next/server';
import { getRouters, getSpeedtests } from '@/lib/dataStore';
import { runRouterSpeedtest } from '@/lib/scheduler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routerId } = await params;
    const allLogs = getSpeedtests();
    const routerLogs = allLogs.filter(log => log.routerId === routerId);
    
    // Sort logs by timestamp descending (newest first)
    routerLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json(routerLogs);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: routerId } = await params;
    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is currently offline and speedtest cannot run' }, { status: 400 });
    }

    console.log(`Manually triggering live SLA speedtest on ${router.name}...`);
    const log = await runRouterSpeedtest(router);

    if (log.status === 'failed') {
      return NextResponse.json({ error: log.error || 'Speedtest execution failed on router.' }, { status: 500 });
    }

    return NextResponse.json(log);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
