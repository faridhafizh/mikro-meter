import { getOutages } from '@/lib/dataStore';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const outages = getOutages();
  const sorted = [...outages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const header = ['Router Name', 'Event', 'Timestamp', 'Duration (minutes)'].map(escapeCsvField).join(',');
  const rows = sorted.map(o => {
    const durationMin = o.durationMs ? Math.round(o.durationMs / 60000) : '';
    return [
      escapeCsvField(o.routerName),
      escapeCsvField(o.event === 'online' ? 'Online' : 'Offline'),
      escapeCsvField(new Date(o.timestamp).toISOString()),
      escapeCsvField(String(durationMin)),
    ].join(',');
  });

  const csv = [header, ...rows].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="outages_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
