'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  business_name: z
    .string()
    .trim()
    .min(1, 'Business name is required.')
    .max(80, 'Business name must be 80 characters or fewer.'),
  cta_text: z
    .string()
    .trim()
    .max(120, 'Call-to-action must be 120 characters or fewer.')
    .optional()
    .or(z.literal('')),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a hex like #FF5577.'),
});

export type Step1Result =
  | { status: 'ok' }
  | { status: 'error'; message: string };

export async function saveBusinessBasics(formData: FormData): Promise<Step1Result> {
  const parsed = Schema.safeParse({
    business_name: formData.get('business_name'),
    cta_text: formData.get('cta_text'),
    accent_color: formData.get('accent_color'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Not signed in.' };
  }

  const { error } = await supabase
    .from('owners')
    .update({
      business_name: parsed.data.business_name,
      cta_text: parsed.data.cta_text || null,
      accent_color: parsed.data.accent_color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.user.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  redirect('/onboarding/step-2');
}
