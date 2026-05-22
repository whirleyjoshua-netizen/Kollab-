import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner?.branding_complete) {
    redirect('/onboarding/step-1');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{userData.user.email}</span>
      </p>
      <p className="text-xs text-muted-foreground font-mono">
        user.id = {userData.user.id}
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
