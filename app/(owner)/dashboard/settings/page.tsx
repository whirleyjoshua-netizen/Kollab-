import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQrCodeUrl } from '@/lib/qr';
import { BrandingForm } from './branding-form';
import { LogoForm } from './logo-form';

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, cta_text, accent_color, logo_path, branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner?.branding_complete) redirect('/onboarding/step-1');

  // Signed URL for current logo (1 hour).
  let existingLogoUrl: string | null = null;
  if (owner.logo_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60);
    existingLogoUrl = signed?.signedUrl ?? null;
  }

  // Default QR for the QR section.
  const { data: defaultQr } = await supabase
    .from('qr_codes')
    .select('id')
    .eq('owner_id', userData.user.id)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  const customerUrl = defaultQr ? getQrCodeUrl(defaultQr.id) : null;
  const qrPngUrl = defaultQr ? `/api/qr/${defaultQr.id}/png` : null;
  const qrPdfLetter = defaultQr ? `/api/qr/${defaultQr.id}/pdf?size=letter` : null;
  const qrPdfA4 = defaultQr ? `/api/qr/${defaultQr.id}/pdf?size=a4` : null;

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <Link href="/dashboard" className="text-sm underline text-muted-foreground">
              ← Inbox
            </Link>
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-4xl px-4 py-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold mb-4">Branding</h2>
          <BrandingForm
            defaults={{
              business_name: owner.business_name,
              cta_text: owner.cta_text,
              accent_color: owner.accent_color,
            }}
          />
        </section>

        <section className="rounded-lg border bg-white p-5">
          <h2 className="text-base font-semibold mb-4">Logo</h2>
          <LogoForm existingLogoUrl={existingLogoUrl} />
        </section>

        <section className="rounded-lg border bg-white p-5 md:col-span-2">
          <h2 className="text-base font-semibold mb-4">Your QR code</h2>

          {defaultQr && qrPngUrl && customerUrl && qrPdfLetter && qrPdfA4 ? (
            <div className="flex flex-col md:flex-row items-start gap-6">
              <div className="rounded-md border bg-white p-3 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrPngUrl}
                  alt="Your Kollab QR code"
                  width={200}
                  height={200}
                />
              </div>

              <div className="flex flex-col gap-3 flex-1">
                <p className="text-sm">
                  <span className="text-muted-foreground">Customer URL:</span>{' '}
                  <code className="font-mono text-xs break-all">{customerUrl}</code>
                </p>

                <div className="flex flex-wrap gap-2">
                  <a
                    href={qrPdfLetter}
                    download
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Download (Letter)
                  </a>
                  <a
                    href={qrPdfA4}
                    download
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Download (A4)
                  </a>
                  <a
                    href={customerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    Preview customer page →
                  </a>
                </div>

                <p className="text-xs text-muted-foreground">
                  Print the PDF and put it where customers can see it. When a
                  customer scans the QR, they land on the page you can preview
                  above with your current branding.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR code found. Try refreshing — your default QR is created during onboarding.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
