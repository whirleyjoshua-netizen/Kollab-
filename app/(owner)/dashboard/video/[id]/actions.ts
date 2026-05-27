'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/db/types';

type Status = Database['public']['Enums']['video_status'];

export type ActionResult<T = void> =
  | { status: 'ok'; data: T }
  | { status: 'error'; message: string };

const StatusSchema = z.enum(['new', 'saved', 'hidden']);

async function getOwnerAndVerifyVideo(videoId: string): Promise<
  | { ownerId: string; storagePath: string; mimeType: string }
  | { error: string }
> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Not signed in' };

  const { data: video, error } = await supabase
    .from('videos')
    .select('id, owner_id, storage_path, mime_type, deleted_at')
    .eq('id', videoId)
    .maybeSingle();

  if (error || !video || video.owner_id !== userData.user.id) {
    return { error: 'Video not found' };
  }
  if (video.deleted_at) {
    return { error: 'Video is deleted' };
  }

  return { ownerId: video.owner_id, storagePath: video.storage_path, mimeType: video.mime_type };
}

export async function updateStatus(videoId: string, newStatus: Status): Promise<ActionResult> {
  const parsed = StatusSchema.safeParse(newStatus);
  if (!parsed.success) return { status: 'error', message: 'Invalid status' };

  const check = await getOwnerAndVerifyVideo(videoId);
  if ('error' in check) return { status: 'error', message: check.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('videos')
    .update({ status: parsed.data })
    .eq('id', videoId);

  if (error) return { status: 'error', message: error.message };

  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/video/${videoId}`);
  return { status: 'ok', data: undefined };
}

export async function softDeleteVideo(videoId: string): Promise<ActionResult> {
  const check = await getOwnerAndVerifyVideo(videoId);
  if ('error' in check) return { status: 'error', message: check.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('videos')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', videoId);

  if (error) return { status: 'error', message: error.message };

  revalidatePath('/dashboard');
  return { status: 'ok', data: undefined };
}

export async function getDownloadUrl(videoId: string, businessName: string): Promise<ActionResult<string>> {
  const check = await getOwnerAndVerifyVideo(videoId);
  if ('error' in check) return { status: 'error', message: check.error };

  const ext = check.mimeType.startsWith('video/mp4')
    ? 'mp4'
    : check.mimeType.startsWith('video/webm')
      ? 'webm'
      : check.mimeType.startsWith('image/png')
        ? 'png'
        : check.mimeType.startsWith('image/webp')
          ? 'webp'
          : 'jpg';
  const slug = businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
  const filename = `kollab-${slug || 'kollab'}-${videoId.slice(0, 8)}.${ext}`;

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from('videos')
    .createSignedUrl(check.storagePath, 60 * 5, { download: filename }); // 5 minutes

  if (signError || !signed) return { status: 'error', message: signError?.message ?? 'Could not sign URL' };

  return { status: 'ok', data: signed.signedUrl };
}
