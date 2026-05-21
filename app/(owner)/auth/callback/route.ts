import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Decide where to land: dashboard if branding is complete, else onboarding.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('branding_complete')
    .eq('id', userData.user.id)
    .single();

  const destination = owner?.branding_complete ? '/dashboard' : '/onboarding/step-1';
  return NextResponse.redirect(`${origin}${destination}`);
}
