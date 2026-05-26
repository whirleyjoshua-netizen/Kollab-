import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { VideoDetail } from './video-detail';

type Params = { params: Promise<{ id: string }> };

export default async function VideoDetailPage({ params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: video } = await supabase
    .from('videos')
    .select('id, owner_id, storage_path, thumbnail_path, mime_type, duration_ms, status, created_at, location_label_snapshot, consent_text_snapshot, size_bytes, deleted_at')
    .eq('id', id)
    .maybeSingle();

  if (!video || video.deleted_at || video.owner_id !== userData.user.id) {
    notFound();
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name')
    .eq('id', video.owner_id)
    .single();

  const admin = createAdminClient();
  const { data: signed } = await admin.storage
    .from('videos')
    .createSignedUrl(video.storage_path, 60 * 60); // 1 hour

  if (!signed) {
    return (
      <main className="min-h-screen bg-zinc-50 p-6">
        <Link href="/dashboard" className="text-sm underline text-muted-foreground">
          ← Back to inbox
        </Link>
        <p className="mt-4 text-sm text-red-700">Could not load the video file. Try again in a moment.</p>
      </main>
    );
  }

  return (
    <VideoDetail
      video={{
        id: video.id,
        videoUrl: signed.signedUrl,
        mimeType: video.mime_type,
        durationMs: video.duration_ms,
        status: video.status,
        createdAt: video.created_at,
        locationLabel: video.location_label_snapshot,
        consentText: video.consent_text_snapshot,
        sizeBytes: video.size_bytes,
      }}
      businessName={owner?.business_name ?? 'Kollab'}
    />
  );
}
