import { redirect } from 'next/navigation';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { Step1Form } from './step-1-form';

export default async function OnboardingStep1Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, cta_text, accent_color, branding_complete')
    .eq('id', userData.user.id)
    .single();

  // If onboarding already complete, send to dashboard.
  if (owner?.branding_complete) redirect('/dashboard');

  return (
    <OnboardingShell
      step={1}
      title="Tell us about your business"
      description="Customers see this on the page they land on after scanning your QR code."
    >
      <Step1Form
        defaults={{
          business_name: owner?.business_name ?? '',
          cta_text: owner?.cta_text ?? null,
          accent_color: owner?.accent_color ?? '#111111',
        }}
      />
    </OnboardingShell>
  );
}
