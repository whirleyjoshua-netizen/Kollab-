'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrCodeId } from '@/lib/qr';

export type FinalizeResult =
  | { status: 'ok' }
  | { status: 'error'; message: string };

export async function finalizeOnboarding(): Promise<FinalizeResult> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Not signed in.' };
  }

  const ownerId = userData.user.id;
  const admin = createAdminClient();

  // Check whether a default QR already exists (idempotency: re-entering Step 3
  // after a transient error shouldn't create duplicate QRs).
  const { data: existingDefault } = await admin
    .from('qr_codes')
    .select('id')
    .eq('owner_id', ownerId)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  if (!existingDefault) {
    // Retry a couple times on the (very unlikely) chance of an id collision.
    let inserted = false;
    let lastError: string | null = null;
    for (let attempt = 0; attempt < 3 && !inserted; attempt++) {
      const newId = generateQrCodeId();
      const { error } = await admin
        .from('qr_codes')
        .insert({
          id: newId,
          owner_id: ownerId,
          is_default: true,
        });
      if (!error) {
        inserted = true;
      } else if (error.code === '23505') {
        // Primary key collision — try again with a new id.
        lastError = error.message;
      } else {
        return { status: 'error', message: error.message };
      }
    }
    if (!inserted) {
      return { status: 'error', message: lastError ?? 'Could not create QR code.' };
    }
  }

  // Flip branding_complete.
  const { error: updateError } = await admin
    .from('owners')
    .update({
      branding_complete: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ownerId);

  if (updateError) {
    return { status: 'error', message: updateError.message };
  }

  redirect('/dashboard');
}
