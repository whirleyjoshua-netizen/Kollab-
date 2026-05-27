import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { verifyFinalizeToken } from '@/lib/upload/finalize-token';

// For videos we expect a JPEG data URL thumbnail. For photos the photo itself
// is the thumbnail so an empty string is acceptable.
const RequestSchema = z.object({
  thumbnailDataUrl: z.string(),
  mediaType: z.enum(['video', 'photo']).default('video'),
  finalizeToken: z.string().min(1),
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

  if (!verifyFinalizeToken(id, parsed.data.finalizeToken)) {
    return NextResponse.json({ error: 'Invalid or expired finalize token' }, { status: 401 });
  }

  // For videos, we require the JPEG thumbnail data URL. Validate that here.
  if (parsed.data.mediaType === 'video' && !/^data:image\/jpeg;base64,/.test(parsed.data.thumbnailDataUrl)) {
    return NextResponse.json({ error: 'Video finalize requires a JPEG thumbnail data URL' }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: video } = await admin
    .from('videos')
    .select('id, owner_id, storage_path, processing_status, media_type')
    .eq('id', id)
    .maybeSingle();

  if (!video) {
    return NextResponse.json({ error: 'Video not found' }, { status: 404 });
  }
  if (video.processing_status !== 'uploading') {
    if (video.processing_status === 'ready') {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json(
      { error: `Cannot finalize from state '${video.processing_status}'` },
      { status: 409 }
    );
  }

  let thumbnailPath: string;

  if (parsed.data.mediaType === 'photo') {
    // Photos don't need a separate thumbnail — the uploaded file IS the
    // thumbnail. Point thumbnail_path at the same storage_path. The owner
    // inbox uses signed URLs from whatever bucket is on the path, so we
    // also leave the actual photo bytes in the `videos` bucket.
    thumbnailPath = video.storage_path;
  } else {
    // Decode the JPEG thumbnail and upload it.
    const base64 = parsed.data.thumbnailDataUrl.replace(/^data:image\/jpeg;base64,/, '');
    const thumbBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    thumbnailPath = `${video.owner_id}/${video.id}.jpg`;

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
  }

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
