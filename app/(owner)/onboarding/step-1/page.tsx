import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingStep1Page() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Kollab — Step 1 of 3</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Business basics will go here in Phase B.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            user.id = {data.user.id}
          </p>
          <Link
            href="/dashboard"
            className="text-sm underline text-muted-foreground"
          >
            Skip to dashboard (placeholder)
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
