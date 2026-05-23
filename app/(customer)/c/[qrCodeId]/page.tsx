import { notFound } from 'next/navigation';
import { createAnonClient } from '@/lib/supabase/anon';
import { createAdminClient } from '@/lib/supabase/admin';
import { CustomerRecorder } from './customer-recorder';

type Params = { params: Promise<{ qrCodeId: string }> };

export default async function CustomerLanding({ params }: Params) {
  const { qrCodeId } = await params;

  const anon = createAnonClient();

  // Look up QR via anon (qr_codes has anon read RLS).
  const { data: qr } = await anon
    .from('qr_codes')
    .select('id, owner_id, location_label, archived_at')
    .eq('id', qrCodeId)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    notFound();
  }

  // Read owner branding via the public view (anon-readable for complete owners).
  const { data: owner } = await anon
    .from('owner_branding')
    .select('business_name, accent_color, cta_text, logo_path, branding_complete')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner || !owner.branding_complete) {
    notFound();
  }

  // Signed URL for the logo is a server-side operation; admin client is fine here
  // (no sensitive data leaks; signed URLs are intentional).
  let logoUrl: string | null = null;
  if (owner.logo_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60 * 6); // 6 hours
    logoUrl = signed?.signedUrl ?? null;
  }

  return (
    <CustomerRecorder
      qrCodeId={qr.id}
      locationLabel={qr.location_label}
      branding={{
        businessName: owner.business_name ?? '',
        accentColor: owner.accent_color ?? '',
        ctaText: owner.cta_text,
        logoUrl,
      }}
    />
  );
}
