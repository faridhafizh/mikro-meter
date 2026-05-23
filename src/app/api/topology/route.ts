import { NextResponse } from 'next/server';
import { getRouters } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

interface TopologyNode {
  id: string;
  label: string;
  type: 'router' | 'neighbor';
  ip?: string;
  mac?: string;
  platform?: string;
  status: 'online' | 'offline' | 'discovered';
}

interface TopologyLink {
  id: string;
  from: string;
  to: string;
  label: string; // The interface name
}

export async function GET() {
  const routers = getRouters();
  const nodes: Record<string, TopologyNode> = {};
  const links: TopologyLink[] = [];

  // 1. Add all registered routers as primary nodes
  for (const router of routers) {
    nodes[router.id] = {
      id: router.id,
      label: router.name,
      type: 'router',
      ip: router.host,
      status: router.status || 'offline',
    };
  }

  // 2. Poll online routers for neighbors
  for (const router of routers) {
    if (router.status !== 'online') continue;

    try {
      // Fetch neighbor discovery detail
      const output = await runSSHCommand(router, '/ip neighbor print detail');
      
      // Parse neighbor print details
      // A block starts with a number at the beginning of a line (or optionally preceded by flags like "D")
      const blocks = output.split(/\r?\n(?=\s*\d+\s+)/);

      for (const block of blocks) {
        if (!block.trim()) continue;

        const interfaceMatch = block.match(/interface=([^\s]+)/);
        const addressMatch = block.match(/address=([^\s]+)/);
        const macMatch = block.match(/mac-address=([^\s]+)/);
        const identityMatch = block.match(/identity="([^"]+)"/) || block.match(/identity=([^\s]+)/);
        const platformMatch = block.match(/platform="([^"]+)"/) || block.match(/platform=([^\s]+)/);

        const iface = interfaceMatch ? interfaceMatch[1] : '';
        const ip = addressMatch ? addressMatch[1] : '';
        const mac = macMatch ? macMatch[1] : '';
        const identity = identityMatch ? identityMatch[1] : '';
        const platform = platformMatch ? platformMatch[1] : '';

        if (!identity && !ip) continue;

        // Check if this neighbor is another registered router in our system
        const matchedRouter = routers.find(r => r.host === ip || (mac && r.host === ip)); // simplified comparison
        
        let targetNodeId = '';

        if (matchedRouter) {
          targetNodeId = matchedRouter.id;
        } else {
          // Add ad-hoc neighbor node
          // Use MAC as unique ID, or IP if MAC is missing, or fallback to identity
          const neighborId = mac || ip || `neighbor-${identity}-${Date.now()}`;
          targetNodeId = neighborId;

          if (!nodes[neighborId]) {
            nodes[neighborId] = {
              id: neighborId,
              label: identity || ip || 'Unknown Neighbor',
              type: 'neighbor',
              ip,
              mac,
              platform,
              status: 'discovered',
            };
          }
        }

        // Create link from current router to the neighbor
        const linkId = `${router.id}-${targetNodeId}-${iface}`;
        
        // Avoid duplicate links in bi-directional neighbor discovery
        const duplicate = links.some(l => 
          (l.from === router.id && l.to === targetNodeId) || 
          (l.from === targetNodeId && l.to === router.id)
        );

        if (!duplicate) {
          links.push({
            id: linkId,
            from: router.id,
            to: targetNodeId,
            label: iface, // Link shows the local interface on this router
          });
        }
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to fetch neighbor details for ${router.name}:`, errMsg);
    }
  }

  return NextResponse.json({
    nodes: Object.values(nodes),
    links,
  });
}
