import { NextResponse } from 'next/server';
import { deleteAlertRule } from '@/lib/dataStore';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const success = deleteAlertRule(id);
  if (!success) {
    return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
