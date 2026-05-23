import { getSpeedtests } from '@/lib/dataStore';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const speedtests = getSpeedtests();
  const sorted = [...speedtests].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const header = ['Router Name', 'Timestamp', 'Download (Mbps)', 'Upload (Mbps)', 'Latency (ms)', 'Jitter (ms)', 'Packet Loss (%)', 'Status'].map(escapeCsvField).join(',');
  const rows = sorted.map(s => [
    escapeCsvField(s.routerName),
    escapeCsvField(new Date(s.timestamp).toISOString()),
    escapeCsvField(s.downloadMbps.toFixed(2)),
    escapeCsvField(s.uploadMbps.toFixed(2)),
    escapeCsvField(s.latencyMs.toFixed(1)),
    escapeCsvField(s.jitterMs.toFixed(1)),
    escapeCsvField(s.packetLossPercent.toFixed(1)),
    escapeCsvField(s.status),
  ].join(','));

  const csv = [header, ...rows].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="speedtests_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
