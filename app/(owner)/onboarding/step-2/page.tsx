import { redirect } from 'next/navigation';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Step2Form } from './step-2-form';

export default async function OnboardingStep2Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, logo_path, branding_complete')
    .eq('id', userData.user.id)
    .single();

  // If Step 1 wasn't done, redirect back.
  if (!owner || !owner.business_name) redirect('/onboarding/step-1');
  if (owner.branding_complete) redirect('/dashboard');

  // Generate a short-lived signed URL for any existing logo (to show in preview).
  let existingLogoUrl: string | null = null;
  if (owner.logo_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60); // 1 hour
    existingLogoUrl = signed?.signedUrl ?? null;
  }

  return (
    <OnboardingShell
      step={2}
      title="Upload your logo"
      description="This shows on the page customers see after scanning your QR code."
    >
      <Step2Form existingLogoUrl={existingLogoUrl} />
    </OnboardingShell>
  );
}
