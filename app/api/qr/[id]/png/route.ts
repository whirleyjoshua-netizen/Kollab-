import { NextResponse, type NextRequest } from 'next/server';
import { toBuffer } from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQrCodeUrl } from '@/lib/qr';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  // Verify the QR exists and is not archived.
  const admin = createAdminClient();
  const { data: qr, error } = await admin
    .from('qr_codes')
    .select('id, archived_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !qr || qr.archived_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = getQrCodeUrl(id);
  const png = await toBuffer(url, {
    errorCorrectionLevel: 'H', // High — recoverable with up to 30% damage / logo overlay later.
    margin: 2,
    scale: 12, // ~360px at default size. Plenty for print at 300 DPI inset into PDF.
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Cache aggressively — QR content never changes for a given ID.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
