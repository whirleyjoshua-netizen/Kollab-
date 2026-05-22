import { notFound } from 'next/navigation';
import { createAnonClient } from '@/lib/supabase/anon';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ qrCodeId: string }> };

export default async function CustomerLanding({ params }: Params) {
  const { qrCodeId } = await params;

  // Use anon client — proves the public-read RLS policy on qr_codes works
  // (anon must be able to look up a QR by id to render this page).
  const anon = createAnonClient();
  const { data: qr } = await anon
    .from('qr_codes')
    .select('id, owner_id, location_label, archived_at')
    .eq('id', qrCodeId)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    notFound();
  }

  // For the owner's branding (logo, business name, accent color, CTA), we need
  // service-role because owners.* is owner-readable only by RLS.
  // Phase C will refactor this into a dedicated read path.
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from('owners')
    .select('business_name, accent_color, cta_text, logo_path')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner) {
    notFound();
  }

  let logoUrl: string | null = null;
  if (owner.logo_path) {
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60 * 6); // 6 hours
    logoUrl = signed?.signedUrl ?? null;
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center"
      style={{ backgroundColor: '#fafafa' }}
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${owner.business_name} logo`}
          className="h-24 w-24 rounded-md object-cover"
        />
      )}
      <h1 className="text-3xl font-bold">{owner.business_name}</h1>
      {qr.location_label && (
        <p className="text-sm text-muted-foreground">{qr.location_label}</p>
      )}
      <p className="max-w-sm text-base text-muted-foreground">
        {owner.cta_text || 'Share a quick video of your experience.'}
      </p>
      <button
        type="button"
        disabled
        className="rounded-md px-8 py-3 font-medium text-white"
        style={{ backgroundColor: owner.accent_color }}
      >
        Start recording (coming soon)
      </button>
      <p className="text-xs text-muted-foreground">
        Recording is launching in the next update.
      </p>
    </main>
  );
}
