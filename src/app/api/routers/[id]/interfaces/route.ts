import { NextResponse } from 'next/server';
import { getRouters } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

interface InterfaceInfo {
  name: string;
  type: string;
  status: 'up' | 'down' | 'disabled';
  speed: string;
  duplex: string;
  mtu: number;
  mac: string;
  rxBps: number;
  txBps: number;
  rxErrors?: number;
  txErrors?: number;
  rxDrop?: number;
  txDrop?: number;
}

function parseInterfaceDetail(output: string): Pick<InterfaceInfo, 'name' | 'type' | 'status' | 'speed' | 'duplex' | 'mtu' | 'mac'>[] {
  const ifaces: Record<string, Pick<InterfaceInfo, 'name' | 'type' | 'status' | 'speed' | 'duplex' | 'mtu' | 'mac'>> = {};
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/name="([^"]+)"/) || block.match(/name=([^\s]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const typeMatch = block.match(/type="([^"]+)"/) || block.match(/type=([^\s]+)/);
    const running = block.includes('running=yes') || block.includes('running');
    const disabled = block.includes('disabled=yes');
    const speedMatch = block.match(/speed="([^"]+)"/) || block.match(/speed=([^\s]+)/);
    const duplexMatch = block.match(/duplex="([^"]+)"/) || block.match(/duplex=([^\s]+)/);
    const mtuMatch = block.match(/mtu=(\d+)/);
    const macMatch = block.match(/mac-address="([^"]+)"/) || block.match(/mac-address=([^\s]+)/);

    let status: 'up' | 'down' | 'disabled';
    if (disabled) status = 'disabled';
    else if (running) status = 'up';
    else status = 'down';

    ifaces[name] = {
      name,
      type: typeMatch ? typeMatch[1] : 'unknown',
      status,
      speed: speedMatch ? speedMatch[1] : 'N/A',
      duplex: duplexMatch ? duplexMatch[1] : 'N/A',
      mtu: mtuMatch ? parseInt(mtuMatch[1]) : 1500,
      mac: macMatch ? macMatch[1] : 'N/A',
    };
  }

  return Object.values(ifaces);
}

function parseMonitorTrafficOutput(output: string): Record<string, { rxBps: number; txBps: number }> {
  const blocks = output.split(/\r?\n\r?\n/);
  const ifaces: Record<string, { rxBps: number; txBps: number }> = {};

  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    let name = '';
    let rxBps = 0;
    let txBps = 0;

    for (const line of lines) {
      const colonIdx = line.indexOf(':');
      if (colonIdx === -1) continue;
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim();

      if (key === 'name') {
        name = val;
      } else if (key === 'rx-bits-per-second') {
        rxBps = parseBps(val);
      } else if (key === 'tx-bits-per-second') {
        txBps = parseBps(val);
      }
    }

    if (name) {
      ifaces[name] = { rxBps, txBps };
    }
  }

  return ifaces;
}

function parseBps(bpsStr: string): number {
  if (!bpsStr) return 0;
  const match = bpsStr.match(/^([0-9.]+)\s*([a-zA-Z]*)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  if (unit.startsWith('g')) return value * 1000 * 1000 * 1000;
  if (unit.startsWith('m')) return value * 1000 * 1000;
  if (unit.startsWith('k')) return value * 1000;
  return value;
}

function parseEthernetStats(output: string): Record<string, { rxErrors: number; txErrors: number; rxDrop: number; txDrop: number }> {
  const stats: Record<string, { rxErrors: number; txErrors: number; rxDrop: number; txDrop: number }> = {};
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/name="([^"]+)"/) || block.match(/name=([^\s]+)/);
    if (!nameMatch) continue;
    const name = nameMatch[1];

    const rxErrors = parseInt(block.match(/rx-errors=(\d+)/)?.[1] || '0');
    const txErrors = parseInt(block.match(/tx-errors=(\d+)/)?.[1] || '0');
    const rxDrop = parseInt(block.match(/rx-drop=(\d+)/)?.[1] || '0');
    const txDrop = parseInt(block.match(/tx-drop=(\d+)/)?.[1] || '0');

    stats[name] = { rxErrors, txErrors, rxDrop, txDrop };
  }

  return stats;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const routers = getRouters();
    const router = routers.find(r => r.id === id);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is offline' }, { status: 400 });
    }

    const [detailOutput, trafficOutput, ethernetOutput] = await Promise.all([
      runSSHCommand(router, '/interface print detail').catch(() => ''),
      runSSHCommand(router, '/interface monitor-traffic [find] once').catch(() => ''),
      runSSHCommand(router, '/interface ethernet print stats').catch(() => ''),
    ]);

    const interfaces = parseInterfaceDetail(detailOutput);
    const traffic = parseMonitorTrafficOutput(trafficOutput);
    const ethStats = parseEthernetStats(ethernetOutput);

    const result: InterfaceInfo[] = interfaces.map(iface => {
      const t = traffic[iface.name];
      const s = ethStats[iface.name];
      return {
        ...iface,
        rxBps: t?.rxBps ?? 0,
        txBps: t?.txBps ?? 0,
        ...(s ? { rxErrors: s.rxErrors, txErrors: s.txErrors, rxDrop: s.rxDrop, txDrop: s.txDrop } : {}),
      };
    });

    return NextResponse.json({ interfaces: result });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
