import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { toDataURL } from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQrCodeUrl } from '@/lib/qr';
import { QrCardPdf } from '@/components/owner/qr-card-pdf';

// @react-pdf/renderer requires Node.js runtime (uses Buffer, streams).
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') === 'a4' ? 'a4' : 'letter';

  const admin = createAdminClient();

  // Look up QR + owner for the business name on the printout.
  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, archived_at, owner_id')
    .eq('id', id)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: owner } = await admin
    .from('owners')
    .select('business_name')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = getQrCodeUrl(id);
  const qrPngDataUrl = await toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 12,
  });

  const pdfBuffer = await renderToBuffer(
    <QrCardPdf
      businessName={owner.business_name || 'Kollab'}
      qrPngDataUrl={qrPngDataUrl}
      size={size}
    />
  );

  const filename = `kollab-qr-${(owner.business_name || 'qr').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
