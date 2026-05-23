import { NextResponse } from 'next/server';
import { getRouters, getStatsHistoryInRange } from '@/lib/dataStore';
import { getRouterHistory } from '@/lib/scheduler';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; iface: string }> }
) {
  try {
    const { id, iface } = await params;
    const routers = getRouters();
    const router = routers.find(r => r.id === id);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range');

    let history;
    if (range === '1h') {
      history = getStatsHistoryInRange(id, 60 * 60 * 1000);
    } else if (range === '6h') {
      history = getStatsHistoryInRange(id, 6 * 60 * 60 * 1000);
    } else if (range === '24h') {
      history = getStatsHistoryInRange(id, 24 * 60 * 60 * 1000);
    } else if (range === '7d') {
      history = getStatsHistoryInRange(id, 7 * 24 * 60 * 60 * 1000);
    } else {
      history = getRouterHistory(id);
    }

    const points = history.map(p => ({
      timestamp: p.timestamp,
      rxBps: p.rxBps[iface] || 0,
      txBps: p.txBps[iface] || 0,
    }));

    return NextResponse.json({ interface: iface, history: points });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
