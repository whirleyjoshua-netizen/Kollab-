'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export type SettingsResult =
  | { status: 'ok'; message?: string }
  | { status: 'error'; message: string };

const BrandingSchema = z.object({
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

export async function updateBranding(formData: FormData): Promise<SettingsResult> {
  const parsed = BrandingSchema.safeParse({
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

  if (error) return { status: 'error', message: error.message };

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { status: 'ok', message: 'Branding saved.' };
}

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export async function replaceLogo(formData: FormData): Promise<SettingsResult> {
  const file = formData.get('logo');

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Please choose a logo image.' };
  }
  if (file.size > MAX_BYTES) {
    return { status: 'error', message: 'Logo must be 2 MB or smaller.' };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { status: 'error', message: 'Logo must be a PNG, JPEG, or WebP image.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Not signed in.' };
  }

  const ext = file.type === 'image/png'
    ? 'png'
    : file.type === 'image/webp'
      ? 'webp'
      : 'jpg';
  const path = `${userData.user.id}/logo.${ext}`;

  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { status: 'error', message: uploadError.message };
  }

  const { error: updateError } = await admin
    .from('owners')
    .update({
      logo_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.user.id);

  if (updateError) {
    return { status: 'error', message: updateError.message };
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/settings');
  return { status: 'ok', message: 'Logo updated.' };
}
