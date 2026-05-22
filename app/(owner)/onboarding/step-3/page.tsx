import Link from 'next/link';
import { redirect } from 'next/navigation';
import { buttonVariants } from '@/components/ui/button';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrCodeId, getQrCodeUrl } from '@/lib/qr';
import { FinalizeButton } from './finalize-button';

export default async function OnboardingStep3Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, logo_path, branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner || !owner.business_name) redirect('/onboarding/step-1');
  if (!owner.logo_path) redirect('/onboarding/step-2');
  if (owner.branding_complete) redirect('/dashboard');

  // Ensure a default QR exists so the preview/download have an ID to point at.
  const admin = createAdminClient();
  let { data: defaultQr } = await admin
    .from('qr_codes')
    .select('id')
    .eq('owner_id', userData.user.id)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  if (!defaultQr) {
    // Insert one now so the user sees a real QR preview. The finalize action
    // is idempotent and won't double-create.
    for (let attempt = 0; attempt < 3 && !defaultQr; attempt++) {
      const newId = generateQrCodeId();
      const { data: inserted, error } = await admin
        .from('qr_codes')
        .insert({
          id: newId,
          owner_id: userData.user.id,
          is_default: true,
        })
        .select('id')
        .single();
      if (!error && inserted) {
        defaultQr = inserted;
      } else if (error && error.code !== '23505') {
        throw new Error(`Failed to create QR: ${error.message}`);
      }
    }
  }

  if (!defaultQr) {
    throw new Error('Could not provision a QR code after retries.');
  }

  const customerUrl = getQrCodeUrl(defaultQr.id);
  const pngUrl = `/api/qr/${defaultQr.id}/png`;
  const pdfLetter = `/api/qr/${defaultQr.id}/pdf?size=letter`;
  const pdfA4 = `/api/qr/${defaultQr.id}/pdf?size=a4`;

  return (
    <OnboardingShell
      step={3}
      title="Your QR code is ready"
      description="Print it and put it on your tables, windows, receipts — wherever customers can see it."
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-md border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pngUrl} alt="Your Kollab QR code" width={240} height={240} />
        </div>

        <p className="text-center text-xs text-muted-foreground break-all">
          Scans to{' '}
          <code className="font-mono">{customerUrl}</code>
        </p>

        <div className="flex w-full flex-col gap-2 pt-2">
          <a href={pdfLetter} download className={buttonVariants({ variant: 'outline' })}>
            Download print-ready PDF (Letter)
          </a>
          <a href={pdfA4} download className={buttonVariants({ variant: 'outline' })}>
            Download print-ready PDF (A4)
          </a>
          <Link
            href={customerUrl}
            target="_blank"
            className="text-center text-sm underline text-muted-foreground"
          >
            Preview the customer experience →
          </Link>
        </div>

        <div className="w-full border-t pt-4">
          <FinalizeButton />
        </div>
      </div>
    </OnboardingShell>
  );
}
