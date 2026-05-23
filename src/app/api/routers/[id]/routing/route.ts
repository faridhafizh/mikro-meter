import { NextResponse } from 'next/server';
import { getRouters } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

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

    const { searchParams } = new URL(request.url);
    const section = searchParams.get('section') || 'all'; // 'all', 'bgp', 'ospf', 'routes'

    const result: RoutingResult = {};

    // BGP Sessions
    if (section === 'all' || section === 'bgp') {
      try {
        const bgpOutput = await runSSHCommand(router, '/routing bgp peer print detail');
        result.bgpSessions = parseBgpSessions(bgpOutput);
      } catch {
        // Try older RouterOS syntax
        try {
          const bgpOutput = await runSSHCommand(router, '/routing bgp peer print');
          result.bgpSessions = parseBgpSessionsOld(bgpOutput);
        } catch {
          result.bgpSessions = [];
          result.bgpError = 'BGP not available on this router or unsupported RouterOS version';
        }
      }
    }

    // OSPF Neighbors
    if (section === 'all' || section === 'ospf') {
      try {
        const ospfOutput = await runSSHCommand(router, '/routing ospf neighbor print detail');
        result.ospfNeighbors = parseOspfNeighbors(ospfOutput);
      } catch {
        try {
          const ospfOutput = await runSSHCommand(router, '/ip ospf neighbor print detail');
          result.ospfNeighbors = parseOspfNeighbors(ospfOutput);
        } catch {
          result.ospfNeighbors = [];
          result.ospfError = 'OSPF not configured on this router';
        }
      }
    }

    // Route Table
    if (section === 'all' || section === 'routes') {
      try {
        // Get route count
        const countOutput = await runSSHCommand(router, '/ip route print count-only');
        const totalRoutes = parseInt(countOutput.trim()) || 0;

        // Get route details (limit to 200 lines for performance)
        const routeOutput = await runSSHCommand(router, '/ip route print detail');
        result.routeTable = parseRouteTable(routeOutput, totalRoutes);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        result.routeTable = { routes: [], total: 0, error: errorMessage };
      }

      // IPv6 routes (if available)
      try {
        const ipv6Output = await runSSHCommand(router, '/ipv6 route print detail');
        result.ipv6Routes = parseRouteTable(ipv6Output, 0);
      } catch {
        // IPv6 not available on this router
      }
    }

    // OSPF Interfaces
    if (section === 'all' || section === 'ospf') {
      try {
        const ospfIfOutput = await runSSHCommand(router, '/routing ospf interface print detail');
        result.ospfInterfaces = parseOspfInterfaces(ospfIfOutput);
      } catch {
        try {
          const ospfIfOutput = await runSSHCommand(router, '/ip ospf interface print detail');
          result.ospfInterfaces = parseOspfInterfaces(ospfIfOutput);
        } catch {
          result.ospfInterfaces = [];
        }
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

interface BgpSession {
  name: string;
  remoteAs: string;
  remoteAddress: string;
  state: string;
  uptime?: string;
  prefixCount?: number;
  localAddress?: string;
}

function parseBgpSessions(output: string): BgpSession[] {
  const sessions: BgpSession[] = [];
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/name="([^"]+)"/) || block.match(/name=([^\s]+)/);
    const asMatch = block.match(/remote-as=([^\s]+)/) || block.match(/remote-as=([^\s]+)/);
    const addrMatch = block.match(/remote-address=([^\s]+)/) || block.match(/remote-address=([^\s]+)/);
    const stateMatch = block.match(/state=([^\s]+)/) || block.match(/established=([^\s]+)/);
    const uptimeMatch = block.match(/uptime=([^\s]+)/);
    const prefixMatch = block.match(/prefix-count=(\d+)/) || block.match(/received-prefixes=(\d+)/);
    const localMatch = block.match(/local-address=([^\s]+)/);

    if (nameMatch) {
      sessions.push({
        name: nameMatch[1],
        remoteAs: asMatch ? asMatch[1] : 'N/A',
        remoteAddress: addrMatch ? addrMatch[1] : 'N/A',
        state: stateMatch ? stateMatch[1] : 'unknown',
        uptime: uptimeMatch ? uptimeMatch[1] : undefined,
        prefixCount: prefixMatch ? parseInt(prefixMatch[1]) : undefined,
        localAddress: localMatch ? localMatch[1] : undefined,
      });
    }
  }

  return sessions;
}

function parseBgpSessionsOld(output: string): BgpSession[] {
  // Old format: simpler tabular output
  const sessions: BgpSession[] = [];
  const lines = output.split('\n');

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4 && parts[0].match(/^\d+$/)) {
      sessions.push({
        name: parts[1] || 'unknown',
        remoteAs: parts[2] || 'N/A',
        remoteAddress: parts[3] || 'N/A',
        state: parts[parts.length - 1] || 'unknown',
      });
    }
  }

  return sessions;
}

interface OspfNeighbor {
  routerId: string;
  address: string;
  interface: string;
  state: string;
  priority?: number;
  dr?: string;
  bdr?: string;
}

function parseOspfNeighbors(output: string): OspfNeighbor[] {
  const neighbors: OspfNeighbor[] = [];
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const routerIdMatch = block.match(/router-id=([^\s]+)/);
    const addrMatch = block.match(/address=([^\s]+)/);
    const ifMatch = block.match(/interface=([^\s]+)/);
    const stateMatch = block.match(/state=([^\s]+)/);
    const prioMatch = block.match(/priority=(\d+)/);

    if (routerIdMatch && addrMatch) {
      neighbors.push({
        routerId: routerIdMatch[1],
        address: addrMatch[1],
        interface: ifMatch ? ifMatch[1] : 'N/A',
        state: stateMatch ? stateMatch[1] : 'unknown',
        priority: prioMatch ? parseInt(prioMatch[1]) : undefined,
      });
    }
  }

  return neighbors;
}

interface RouteEntry {
  dstAddress: string;
  gateway: string;
  distance: number;
  routingMark: string;
  interface: string;
  prefSrc?: string;
  scope?: number;
  dynamic: boolean;
  type: string;
  comment?: string;
}

interface RoutingResult {
  bgpSessions?: BgpSession[];
  ospfNeighbors?: OspfNeighbor[];
  ospfInterfaces?: OspfInterface[];
  routeTable?: { routes: RouteEntry[]; total: number; error?: string };
  ipv6Routes?: { routes: RouteEntry[]; total: number };
  bgpError?: string;
  ospfError?: string;
}

interface OspfInterface {
  name: string;
  area: string;
  state: string;
  cost: number;
  type: string;
  passive: boolean;
  networkType?: string;
}

function parseOspfInterfaces(output: string): OspfInterface[] {
  const interfaces: OspfInterface[] = [];
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const nameMatch = block.match(/interface=([^\s]+)/) || block.match(/name="([^"]+)"/) || block.match(/name=([^\s]+)/);
    const areaMatch = block.match(/area=([^\s]+)/);
    const stateMatch = block.match(/state=([^\s]+)/);
    const costMatch = block.match(/cost=(\d+)/);
    const typeMatch = block.match(/type=([^\s]+)/);
    const passiveMatch = block.includes('passive=yes');

    if (nameMatch) {
      interfaces.push({
        name: nameMatch[1],
        area: areaMatch ? areaMatch[1] : 'N/A',
        state: stateMatch ? stateMatch[1] : 'unknown',
        cost: costMatch ? parseInt(costMatch[1]) : 0,
        type: typeMatch ? typeMatch[1] : 'unknown',
        passive: passiveMatch,
      });
    }
  }

  return interfaces;
}

function parseRouteTable(output: string, totalCount: number): { routes: RouteEntry[]; total: number } {
  const routes: RouteEntry[] = [];
  const blocks = output.split(/\r?\n(?=\s*\d+\s)/);

  for (const block of blocks) {
    const dstMatch = block.match(/dst-address=([^\s]+)/) || block.match(/dst-address=([^\s]+)/);
    const gwMatch = block.match(/gateway=([^\s]+)/) || block.match(/gateway=([^\s]+)/);
    const distMatch = block.match(/distance=(\d+)/);
    const routingMarkMatch = block.match(/routing-mark=([^\s]+)/);
    const ifMatch = block.match(/interface=([^\s]+)/);
    const prefMatch = block.match(/pref-src=([^\s]+)/);
    const dynamic = block.includes('dynamic');
    const commentMatch = block.match(/comment="([^"]+)"/) || block.match(/comment=([^\s]+)/);
    const _typeMatch = block.match(/(?:^|\s)([A-Z])\s/) || ['', ''];

    // Determine type from the flag character
    let type = 'static';
    if (dynamic) type = 'dynamic';
    if (block.includes('connect')) type = 'connected';
    if (block.includes('S ')) type = 'static';
    if (block.includes('D ')) type = 'dynamic';
    if (block.includes('C ')) type = 'connected';
    if (block.includes('A ')) type = 'active';
    if (block.includes('B ')) type = 'blackhole';

    if (dstMatch) {
      routes.push({
        dstAddress: dstMatch[1],
        gateway: gwMatch ? gwMatch[1] : 'N/A',
        distance: distMatch ? parseInt(distMatch[1]) : 0,
        routingMark: routingMarkMatch ? routingMarkMatch[1] : 'main',
        interface: ifMatch ? ifMatch[1] : 'N/A',
        prefSrc: prefMatch ? prefMatch[1] : undefined,
        dynamic,
        type,
        comment: commentMatch ? commentMatch[1] : undefined,
      });
    }
  }

  return { routes, total: totalCount || routes.length };
}
