'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  email: z.string().email(),
});

export type LoginResult =
  | { status: 'ok'; email: string }
  | { status: 'error'; message: string };

export async function sendMagicLink(formData: FormData): Promise<LoginResult> {
  const parsed = Schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'ok', email: parsed.data.email };
}
