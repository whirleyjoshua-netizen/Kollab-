'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type Step2Result =
  | { status: 'ok' }
  | { status: 'error'; message: string };

export async function uploadLogo(formData: FormData): Promise<Step2Result> {
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

  // Upload (upsert so replacing the logo works).
  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { status: 'error', message: uploadError.message };
  }

  // Persist the path on the owners row.
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

  redirect('/onboarding/step-3');
}
