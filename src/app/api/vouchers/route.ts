import { NextResponse } from 'next/server';
import { getVouchers, deleteVoucher } from '@/lib/dataStore';

export async function GET() {
  try {
    const vouchers = getVouchers();
    return NextResponse.json(vouchers);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing voucher ID parameter' }, { status: 400 });
    }

    const success = deleteVoucher(id);
    if (!success) {
      return NextResponse.json({ error: 'Voucher log not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Voucher log deleted from storage' });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
