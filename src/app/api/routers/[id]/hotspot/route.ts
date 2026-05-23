import { NextResponse } from 'next/server';
import { getRouters, saveVoucher, HotspotVoucher } from '@/lib/dataStore';
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

    // 1. Fetch Hotspot Profiles
    const profilesOutput = await runSSHCommand(router, '/ip hotspot user profile print').catch(() => '');
    
    // Parse profiles
    const profiles: string[] = [];
    const profileLines = profilesOutput.split('\n');
    for (const line of profileLines) {
      // Look for lines containing names. e.g. " 0 * name="default" ..." or " 1   name="3mbps" ..."
      const match = line.match(/name="([^"]+)"/) || line.match(/name=(\S+)/);
      if (match) {
        profiles.push(match[1]);
      }
    }
    // Make sure we at least have 'default'
    if (profiles.length === 0) {
      profiles.push('default');
    }

    // 2. Fetch Active Hotspot Users
    const activeOutput = await runSSHCommand(router, '/ip hotspot active print').catch(() => '');
    const activeUsers: { user: string; address: string; mac: string; uptime: string }[] = [];
    
    const activeBlocks = activeOutput.split(/\r?\n/);
    for (const line of activeBlocks) {
      if (line.includes('flags') || line.trim().startsWith('#') || line.trim() === '') continue;
      
      // Parse active details. In RouterOS:
      // " 0   server1     user1       192.168.88.254  00:11:22:33:44:55 5m4s"
      const tokens = line.trim().split(/\s+/).filter(t => t !== '');
      if (tokens.length >= 5) {
        // Find if tokens look like IP / MAC
        const ipIdx = tokens.findIndex(t => t.match(/^\d+\.\d+\.\d+\.\d+$/));
        const macIdx = tokens.findIndex(t => t.match(/^([0-9a-fA-F]{2}:){5}[0-9a-fA-F]{2}$/));
        
        if (ipIdx !== -1 && macIdx !== -1) {
          const user = tokens[ipIdx - 1] || 'unknown';
          const address = tokens[ipIdx];
          const mac = tokens[macIdx];
          const uptime = tokens[macIdx + 1] || '0s';
          
          activeUsers.push({ user, address, mac, uptime });
        }
      }
    }

    return NextResponse.json({
      profiles,
      activeUsers
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
    const { profile, limitUptime, limitBytes, code } = body;

    const routers = getRouters();
    const router = routers.find(r => r.id === routerId);

    if (!router) {
      return NextResponse.json({ error: 'Router not found' }, { status: 404 });
    }

    if (router.status !== 'online') {
      return NextResponse.json({ error: 'Router is currently offline' }, { status: 400 });
    }

    // Generate random voucher code if not provided
    const voucherCode = code ? code.toUpperCase().trim() : generateVoucherCode();

    // Prepare SSH command
    // Format: /ip hotspot user add name="code" password="code" profile="profile" limit-uptime="uptime" limit-bytes-total="bytes"
    let cmd = `/ip hotspot user add name="${voucherCode}" password="${voucherCode}"`;
    if (profile) {
      cmd += ` profile="${profile}"`;
    }
    if (limitUptime && limitUptime !== 'none') {
      cmd += ` limit-uptime="${limitUptime}"`;
    }
    if (limitBytes && Number(limitBytes) > 0) {
      cmd += ` limit-bytes-total=${Number(limitBytes)}`;
    }
    cmd += ` comment="MikroMeter-Voucher"`;

    await runSSHCommand(router, cmd);

    // Save in local storage
    const newVoucher: HotspotVoucher = {
      id: `voucher-${Date.now()}`,
      routerId: router.id,
      routerName: router.name,
      username: voucherCode,
      password: voucherCode,
      profile: profile || 'default',
      limitUptime: limitUptime || undefined,
      limitBytes: limitBytes ? Number(limitBytes) : undefined,
      timestamp: new Date().toISOString(),
      status: 'active'
    };

    saveVoucher(newVoucher);

    return NextResponse.json(newVoucher, { status: 201 });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

function generateVoucherCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // omit ambiguous chars like I, O, 0, 1
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `V-${code.slice(0, 3)}-${code.slice(3)}`;
}
