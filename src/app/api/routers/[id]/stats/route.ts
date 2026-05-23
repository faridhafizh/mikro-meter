import { NextResponse } from 'next/server';
import { getRouters, getStatsHistoryInRange } from '@/lib/dataStore';
import { getRouterHistory } from '@/lib/scheduler';
import { runSSHCommand } from '@/lib/sshClient';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const routers = getRouters();
  const router = routers.find(r => r.id === id);

  if (!router) {
    return NextResponse.json({ error: 'Router not found' }, { status: 404 });
  }

  // Time-range filtering for historical bandwidth trending
  const { searchParams } = new URL(request.url);
  const range = searchParams.get('range'); // '1h', '6h', '24h', '7d'

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
    // Default: use in-memory + persisted combined (full recent history)
    history = getRouterHistory(id);
  }
  
  const latest = history.length > 0 ? history[history.length - 1] : null;

  // Let's also retrieve interface names and PPPoE lists from the live router if requested
  const includeInterfaces = searchParams.get('interfaces') === 'true';
  const includePppoeList = searchParams.get('pppoe') === 'true';

  const interfaceList: string[] = [];
  const pppoeActiveUsers: { id: string; name: string; service: string; callerId: string; address: string; uptime: string }[] = [];

  if (router.status === 'online') {
    try {
      if (includeInterfaces) {
        // Run "/interface print" to get interface names
        const output = await runSSHCommand(router, '/interface print');
        const lines = output.split('\n');
        for (const line of lines) {
          // Lines contain details, look for interface name
          // Standard format: " 0  R  ether1                    ether      1500  1598"
          // We can parse words, usually it's column 3.
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 4 && !line.includes('FLAGS') && !line.startsWith('#')) {
            // Determine name by looking at parts
            // Flag chars can be: R, X, D, etc. (parts[1] or parts[2])
            // Name is usually the one that matches letters
            const nameCandidate = parts.find(p => p.match(/^[a-zA-Z0-9_\-]+$/) && !p.match(/^[0-9]+$/) && p !== 'R' && p !== 'X' && p !== 'D' && p !== 'S');
            if (nameCandidate && !['ether','vlan','wlan','bridge','pppoe','sstp','ovpn','l2tp'].includes(nameCandidate.toLowerCase())) {
              interfaceList.push(nameCandidate);
            }
          }
        }
        // Fallback or override: clean parse by just doing command "/interface print as-value" or similar, 
        // but since older RouterOS versions might print differently, we can also query "/interface print detail"
        // Let's do a simpler CLI print: "/interface print" and check.
        // Wait, a very reliable way to get names in RouterOS is:
        // "/interface find" or "/interface print value-list" or just "/interface print as-value" if ROS v6.x+
        // Let's try "/interface print detail" and regex name=...
        const detailOutput = await runSSHCommand(router, '/interface print detail');
        const matches = detailOutput.matchAll(/name="([^"]+)"/g);
        for (const m of matches) {
          if (!interfaceList.includes(m[1])) {
            interfaceList.push(m[1]);
          }
        }
        // Also match standard name key-value if not enclosed in quotes:
        const matchesNoQuotes = detailOutput.matchAll(/name=([^\s]+)/g);
        for (const m of matchesNoQuotes) {
          if (!interfaceList.includes(m[1]) && !m[1].includes('"')) {
            interfaceList.push(m[1]);
          }
        }
      }

      if (includePppoeList) {
        // Run "/ppp active print" to get active users detail
        const output = await runSSHCommand(router, '/ppp active print');
        const lines = output.split('\n');
        // Example output:
        //  #    NAME         SERVICE CALLER-ID         ADDRESS         UPTIME
        //  0    user1        pppoe   00:11:22:33:44:55 10.10.10.254    1h12m5s
        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5 && parts[0].match(/^[0-9]+$/)) {
            // Active session parsed
            pppoeActiveUsers.push({
              id: parts[0],
              name: parts[1],
              service: parts[2],
              callerId: parts[3],
              address: parts[4],
              uptime: parts[5] || 'unknown',
            });
          }
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to retrieve live stats for ${router.name}:`, errMsg);
    }
  }

  return NextResponse.json({
    latest,
    history,
    interfaces: interfaceList.length ? interfaceList : undefined,
    pppoeList: includePppoeList ? pppoeActiveUsers : undefined
  });
}
