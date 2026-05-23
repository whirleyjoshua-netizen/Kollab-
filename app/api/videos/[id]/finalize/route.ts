import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';

const RequestSchema = z.object({
  thumbnailDataUrl: z.string().regex(/^data:image\/jpeg;base64,/),
});

type Params = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Invalid request' },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Look up the video to find the owner (for thumbnail path) and confirm
  // it's still in the 'uploading' state.
  const { data: video } = await admin
    .from('videos')
    .select('id, owner_id, processing_status')
    .eq('id', id)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }
  if (video.processing_status !== 'uploading') {
    // Idempotent: if already 'ready', no-op success. If 'failed', reject.
    if (video.processing_status === 'ready') {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: `Cannot finalize from state '${video.processing_status}'` },
      { status: 409 }
    );
  }

  // Decode the thumbnail base64 into a buffer.
  const base64 = parsed.data.thumbnailDataUrl.replace(/^data:image\/jpeg;base64,/, '');
  const thumbBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
  const thumbnailPath = `${video.owner_id}/${video.id}.jpg`;

  const { error: thumbUploadError } = await admin.storage
    .from('thumbnails')
    .upload(thumbnailPath, thumbBytes, {
      contentType: 'image/jpeg',
      upsert: true,
    });

  if (thumbUploadError) {
    return NextResponse.json(
      { error: `Thumbnail upload failed: ${thumbUploadError.message}` },
      { status: 500 }
    );
  }

  // Flip to 'ready' and persist the thumbnail path.
  const { error: updateError } = await admin
    .from('videos')
    .update({
      processing_status: 'ready',
      thumbnail_path: thumbnailPath,
    })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
