import { NextResponse } from 'next/server';
import { getRouters } from '@/lib/dataStore';
import { runSSHCommand } from '@/lib/sshClient';

export async function GET(
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
      return NextResponse.json({ error: 'Router is currently offline' }, { status: 400 });
    }

    // 1. Ensure IP Accounting is enabled and take a snapshot
    await runSSHCommand(router, '/ip accounting set enabled=yes threshold=2560').catch(() => {});
    await runSSHCommand(router, '/ip accounting snapshot take').catch(() => {});
    
    // 2. Fetch DHCP Leases
    const dhcpOutput = await runSSHCommand(router, '/ip dhcp-server lease print detail').catch(() => '');
    
    // 3. Fetch IP Accounting snapshot
    const accountingOutput = await runSSHCommand(router, '/ip accounting snapshot print').catch(() => '');

    // 4. Fetch Firewall Blocked IP address-list to check who is currently blocked
    const blockedOutput = await runSSHCommand(router, '/ip firewall address-list print where list=MikroMeter_Blocked').catch(() => '');

    // Parse Blocked List
    const blockedIps = new Set<string>();
    const blockedLines = blockedOutput.split('\n');
    for (const line of blockedLines) {
      // Look for IP addresses
      const ipMatch = line.match(/address=(\d+\.\d+\.\d+\.\d+)/) || line.match(/(\d+\.\d+\.\d+\.\d+)/);
      if (ipMatch) {
        blockedIps.add(ipMatch[1]);
      }
    }

    // Parse DHCP leases
    // Example line in lease print detail:
    // "0   address=192.168.88.254 mac-address=00:11:22:33:44:55 client-id="1:0:11:22:33:44:55" server=dhcp1 dhcp-option="" status=bound host-name="Android-Device" last-seen=23s"
    interface Lease {
      ip: string;
      mac: string;
      hostname: string;
      status: string;
      isStatic: boolean;
      isBlocked: boolean;
    }
    const leases: Record<string, Lease> = {};

    const dhcpLines = dhcpOutput.split('\n');
    for (const line of dhcpLines) {
      if (line.includes('flags') || line.trim() === '') continue;
      
      const ipMatch = line.match(/address=([^\s]+)/);
      const macMatch = line.match(/mac-address=([^\s]+)/);
      const hostMatch = line.match(/host-name="([^"]+)"/) || line.match(/host-name=([^\s]+)/);
      const statusMatch = line.match(/status=([^\s]+)/);
      
      // Flags: 'D' means dynamic, if 'D' is NOT in the flags at start, it is static.
      const isDynamic = line.startsWith('D') || line.trim().startsWith('D') || line.includes(' dynamic=yes');
      const isStatic = !isDynamic;

      if (ipMatch && macMatch) {
        const ip = ipMatch[1];
        const mac = macMatch[1];
        const hostname = hostMatch ? hostMatch[1] : 'Unknown';
        const status = statusMatch ? statusMatch[1] : 'bound';
        const isBlocked = blockedIps.has(ip);

        leases[ip] = {
          ip,
          mac,
          hostname,
          status,
          isStatic,
          isBlocked
        };
      }
    }

    // Parse IP Accounting to find Top Talkers
    // Group byte counts by Source IP address
    const trafficMap: Record<string, number> = {};
    const accLines = accountingOutput.split('\n');
    for (const line of accLines) {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length >= 3) {
        const srcIp = tokens[0];
        const bytes = parseInt(tokens[2]);
        
        // Ensure tokens[0] is indeed an IP address
        if (srcIp.match(/^\d+\.\d+\.\d+\.\d+$/) && !isNaN(bytes)) {
          // Avoid aggregate bytes for local gateway or broadcast if needed,
          // but usually just summing everything is perfectly fine
          trafficMap[srcIp] = (trafficMap[srcIp] || 0) + bytes;
        }
      }
    }

    // Merge Lease + Traffic details
    const activeClients: {
      ip: string;
      mac: string;
      hostname: string;
      bytesConsumed: number;
      isStatic: boolean;
      isBlocked: boolean;
      status: string;
    }[] = [];

    // All active leases
    for (const [ip, lease] of Object.entries(leases)) {
      activeClients.push({
        ip,
        mac: lease.mac,
        hostname: lease.hostname,
        bytesConsumed: trafficMap[ip] || 0,
        isStatic: lease.isStatic,
        isBlocked: lease.isBlocked,
        status: lease.status
      });
    }

    // Also catch any IP that has traffic but is not in DHCP leases (e.g. static IPs or external routing)
    for (const [ip, bytes] of Object.entries(trafficMap)) {
      if (!leases[ip] && ip.match(/^(192\.168|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/)) {
        activeClients.push({
          ip,
          mac: 'Unknown (Static IP)',
          hostname: 'Static Endpoint',
          bytesConsumed: bytes,
          isStatic: true,
          isBlocked: blockedIps.has(ip),
          status: 'active'
        });
      }
    }

    // Sort clients by bytesConsumed descending
    activeClients.sort((a, b) => b.bytesConsumed - a.bytesConsumed);

    return NextResponse.json({
      clients: activeClients
    });
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
    const body = await request.json();
    const { action, ip } = body; // action: 'static' | 'block' | 'unblock'

    if (!action || !ip) {
      return NextResponse.json({ error: 'Missing required parameters: action, ip' }, { status: 400 });
    }

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is offline' }, { status: 400 });
    }

    if (action === 'static') {
      // Make dynamic lease static
      const cmd = `/ip dhcp-server lease make-static [find address="${ip}"]`;
      await runSSHCommand(router, cmd);
      return NextResponse.json({ success: true, message: `DHCP Lease for ${ip} successfully bound static.` });
    } 
    
    if (action === 'block') {
      // 1. Ensure the block list drop rule exists at index 0 in firewall filter
      const checkRule = await runSSHCommand(router, '/ip firewall filter print where comment="Blocked by MikroMeter"').catch(() => '');
      if (!checkRule.includes('Blocked by MikroMeter')) {
        // Place blocked list drop rule at place-before=0 to bypass all accepts
        await runSSHCommand(router, '/ip firewall filter add chain=forward action=drop src-address-list=MikroMeter_Blocked comment="Blocked by MikroMeter" place-before=0').catch(() => {});
        await runSSHCommand(router, '/ip firewall filter add chain=forward action=drop dst-address-list=MikroMeter_Blocked comment="Blocked by MikroMeter" place-before=0').catch(() => {});
      }

      // 2. Add client IP to blocked address-list
      const addListCmd = `/ip firewall address-list add list=MikroMeter_Blocked address=${ip} comment="Blocked via MikroMeter"`;
      await runSSHCommand(router, addListCmd);

      return NextResponse.json({ success: true, message: `IP Address ${ip} has been blocked and added to blocklist.` });
    } 
    
    if (action === 'unblock') {
      // Remove client IP from blocked address-list
      const removeListCmd = `/ip firewall address-list remove [find list=MikroMeter_Blocked address="${ip}"]`;
      await runSSHCommand(router, removeListCmd);
      
      return NextResponse.json({ success: true, message: `IP Address ${ip} has been successfully unblocked.` });
    }

    return NextResponse.json({ error: 'Invalid action parameter' }, { status: 400 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
