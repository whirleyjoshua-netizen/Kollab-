import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Database } from '@/lib/db/types';

export type InboxVideo = {
  id: string;
  thumbnailUrl: string | null;
  locationLabel: string | null;
  status: Database['public']['Enums']['video_status'];
  createdAt: string;
  durationMs: number | null;
};

export type InboxPage = {
  videos: InboxVideo[];
  hasMore: boolean;
};

const PAGE_SIZE = 24;

/**
 * Fetch a page of the signed-in owner's videos (newest first, ready + not deleted).
 * Returns InboxPage with at most PAGE_SIZE rows and a hasMore flag.
 * Throws if not signed in.
 */
export async function fetchInboxPage(page = 0): Promise<InboxPage> {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    throw new Error('Not signed in');
  }

  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE; // fetch one extra row to detect hasMore

  const { data: rows, error } = await supabase
    .from('videos')
    .select('id, thumbnail_path, location_label_snapshot, status, created_at, duration_ms')
    .eq('owner_id', userData.user.id)
    .eq('processing_status', 'ready')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    throw new Error(error.message);
  }

  const hasMore = rows.length > PAGE_SIZE;
  const trimmed = hasMore ? rows.slice(0, PAGE_SIZE) : rows;

  // Sign thumbnail URLs server-side. Use the admin client (signed URLs bypass
  // RLS anyway, and we already have admin available).
  const admin = createAdminClient();
  const videos: InboxVideo[] = await Promise.all(
    trimmed.map(async (row) => {
      let thumbnailUrl: string | null = null;
      if (row.thumbnail_path) {
        const { data: signed } = await admin.storage
          .from('thumbnails')
          .createSignedUrl(row.thumbnail_path, 60 * 60); // 1 hour
        thumbnailUrl = signed?.signedUrl ?? null;
      }
      return {
        id: row.id,
        thumbnailUrl,
        locationLabel: row.location_label_snapshot,
        status: row.status,
        createdAt: row.created_at,
        durationMs: row.duration_ms,
      };
    })
  );

  return { videos, hasMore };
}

export const INBOX_PAGE_SIZE = PAGE_SIZE;
