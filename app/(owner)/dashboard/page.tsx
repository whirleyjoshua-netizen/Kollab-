import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { fetchInboxPage } from '@/lib/videos/list';
import { getQrCodeUrl } from '@/lib/qr';
import { signOut } from './actions';
import { InboxGrid } from './inbox-grid';
import { InboxEmpty } from './inbox-empty';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner?.branding_complete) {
    redirect('/onboarding/step-1');
  }

  // Get the owner's default QR (for empty-state guidance + customer URL preview).
  const { data: defaultQr } = await supabase
    .from('qr_codes')
    .select('id')
    .eq('owner_id', userData.user.id)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  const initialPage = await fetchInboxPage(0);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold">{owner.business_name}</h1>
            <span className="text-xs text-muted-foreground">Inbox</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/settings"
              className="text-sm underline text-muted-foreground hover:text-foreground"
            >
              Settings
            </Link>
            <form action={signOut}>
              <Button type="submit" variant="outline" size="sm">
                Sign out
              </Button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {initialPage.videos.length === 0 ? (
          defaultQr ? (
            <InboxEmpty
              qrCodeId={defaultQr.id}
              customerUrl={getQrCodeUrl(defaultQr.id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR code found. Try refreshing — your default QR is created during onboarding.
            </p>
          )
        ) : (
          <InboxGrid initial={initialPage} />
        )}
      </div>
    </main>
  );
}
