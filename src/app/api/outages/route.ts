import { NextResponse } from 'next/server';
import { getOutages } from '@/lib/dataStore';

export async function GET() {
  const outages = getOutages();
  // Sort descending by timestamp (newest first)
  const sorted = [...outages].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return NextResponse.json(sorted);
}
