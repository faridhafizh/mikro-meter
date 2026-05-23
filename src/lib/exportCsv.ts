/**
 * Converts an array of objects to CSV format and returns the CSV string.
 */
export function toCsv<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string; format?: (val: unknown) => string }[]
): string {
  if (data.length === 0) return '';

  const header = columns.map(c => escapeCsvField(c.label)).join(',');
  const rows = data.map(row => {
    return columns.map(col => {
      const val = row[col.key];
      const formatted = col.format ? col.format(val) : String(val ?? '');
      return escapeCsvField(formatted);
    }).join(',');
  });

  return [header, ...rows].join('\r\n');
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Triggers a browser download of a CSV file.
 */
export function downloadCsv(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
