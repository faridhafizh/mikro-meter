import { getBackups } from '@/lib/dataStore';

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET() {
  const backups = getBackups();
  const sorted = [...backups].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const header = ['Router Name', 'File Name', 'Format', 'Size (KB)', 'Timestamp', 'Status'].map(escapeCsvField).join(',');
  const rows = sorted.map(b => [
    escapeCsvField(b.routerName),
    escapeCsvField(b.filename),
    escapeCsvField(b.format.toUpperCase()),
    escapeCsvField(b.status === 'success' ? (b.sizeBytes / 1024).toFixed(2) : '0'),
    escapeCsvField(new Date(b.timestamp).toISOString()),
    escapeCsvField(b.status),
  ].join(','));

  const csv = [header, ...rows].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv;charset=utf-8',
      'Content-Disposition': `attachment; filename="backups_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
