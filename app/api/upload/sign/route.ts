import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { renderConsentText } from '@/lib/consent';

const MAX_BYTES = 50 * 1024 * 1024;        // 50MB hard cap
const MAX_DURATION_MS = 31_000;             // 30s + 1s grace

const RequestSchema = z.object({
  qrCodeId: z.string().min(1).max(64),
  mimeType: z.string().min(1).max(120),
  sizeBytes: z.number().int().positive().max(MAX_BYTES),
  durationMs: z.number().int().positive().max(MAX_DURATION_MS),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
});

export async function POST(request: NextRequest) {
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

  const { qrCodeId, mimeType, sizeBytes, durationMs, width, height } = parsed.data;

  const admin = createAdminClient();

  // Look up QR + owner.
  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, owner_id, location_label, archived_at')
    .eq('id', qrCodeId)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    return NextResponse.json({ error: 'QR code not found' }, { status: 404 });
  }

  const { data: owner } = await admin
    .from('owners')
    .select('business_name, branding_complete')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner || !owner.branding_complete) {
    return NextResponse.json({ error: 'Business not ready' }, { status: 404 });
  }

  // Build the storage path and consent snapshot before inserting.
  const ext = mimeTypeToExtension(mimeType);
  if (!ext) {
    return NextResponse.json({ error: 'Unsupported mime type' }, { status: 400 });
  }

  const ipHash = await hashIp(request);

  const { data: video, error: insertError } = await admin
    .from('videos')
    .insert({
      owner_id: qr.owner_id,
      qr_code_id: qr.id,
      storage_path: 'pending', // placeholder, updated next
      mime_type: mimeType,
      duration_ms: durationMs,
      width,
      height,
      size_bytes: sizeBytes,
      consent_text_snapshot: renderConsentText(owner.business_name),
      location_label_snapshot: qr.location_label,
      processing_status: 'uploading',
      ip_hash: ipHash,
    })
    .select('id')
    .single();

  if (insertError || !video) {
    return NextResponse.json(
      { error: insertError?.message ?? 'Could not create video record' },
      { status: 500 }
    );
  }

  const storagePath = `${qr.owner_id}/${video.id}.${ext}`;

  // Persist the real storage_path now that we have the video.id.
  const { error: pathUpdateError } = await admin
    .from('videos')
    .update({ storage_path: storagePath })
    .eq('id', video.id);

  if (pathUpdateError) {
    return NextResponse.json(
      { error: pathUpdateError.message },
      { status: 500 }
    );
  }

  // Create a signed upload URL.
  const { data: signed, error: signError } = await admin.storage
    .from('videos')
    .createSignedUploadUrl(storagePath);

  if (signError || !signed) {
    return NextResponse.json(
      { error: signError?.message ?? 'Could not sign upload URL' },
      { status: 500 }
    );
  }

  return NextResponse.json({
    videoId: video.id,
    storagePath,
    uploadUrl: signed.signedUrl,
    token: signed.token,
  });
}

function mimeTypeToExtension(mime: string): string | null {
  if (mime.startsWith('video/mp4')) return 'mp4';
  if (mime.startsWith('video/webm')) return 'webm';
  return null;
}

async function hashIp(request: NextRequest): Promise<string | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    null;
  if (!ip) return null;
  const data = new TextEncoder().encode(ip);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
