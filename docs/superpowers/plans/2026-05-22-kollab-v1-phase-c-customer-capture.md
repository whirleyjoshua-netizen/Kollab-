# Kollab v1 — Phase C: Customer Video Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A customer scans a QR code → opens the branded landing → taps "Start recording" → records up to 30 seconds of vertical video → previews it → taps "Send to [Business Name]" → the video lands in the `videos` table with `processing_status='ready'` and a thumbnail. Works on real iPhones (Safari 14.5+) and Android phones (Chrome current).

**Architecture:** A single state-machine client component on `/c/[qrCodeId]` orchestrates the entire customer flow (idle → permission → recording → preview → sending → thanks). MediaRecorder API for capture with codec detection per platform and a 2.5 Mbps bitrate cap (critical for storage cost). Upload is server-proxied via a Next.js route that pre-creates a `videos` row with `processing_status='uploading'`, returns a signed upload URL to the client, the client PUTs the blob directly to Supabase Storage, then calls a finalize endpoint that flips `processing_status='ready'` and writes the thumbnail. **Deviation from spec:** the spec recommended TUS resumable uploads; for v1 we use plain signed-URL PUT with a retry button on failure. TUS is deferred to a future phase if real-world upload reliability requires it. Client captures the thumbnail as a canvas snapshot at record-stop time.

**Tech Stack:** Next.js 16 App Router (single client component for the customer flow), MediaRecorder API, getUserMedia, native `<canvas>` for thumbnail extraction, Supabase Storage signed upload URLs, server-side `videos` row provisioning via service role.

**Reference spec:** `docs/superpowers/specs/2026-05-19-kollab-v1-design.md`
**Predecessor plans:**
- Phase A: `docs/superpowers/plans/2026-05-19-kollab-v1-phase-a-foundation.md` (tag `phase-a-complete`)
- Phase B: `docs/superpowers/plans/2026-05-22-kollab-v1-phase-b-onboarding.md` (tag `phase-b-complete`)

**Phase C carryovers from Phase B review:**
- **Addressed in this plan:** Task 1 creates `public.owner_branding` view and refactors customer landing to use anon client only (eliminates service-role on a public route).
- **Deferred to Phase D:** PNG/PDF endpoint owner-gating (accepted as public for v1 — the QR is public by design; the PDF leaks only business name and URL, which are public-facing anyway).
- **Deferred (polish):** PDF filename slug regex improvement — non-blocking.

---

## Task 1: Carryover — `public.owner_branding` view + anon RLS

Customer landing currently uses the admin (service role) client to read owner branding because `owners` is owner-readable only. Replace with a Postgres view exposing only the safe public columns.

**Files:**
- Create: `supabase/migrations/<timestamp>_public_owner_branding_view.sql`

- [ ] **Step 1: Create migration**

```powershell
pnpm exec supabase migration new public_owner_branding_view
```

- [ ] **Step 2: Write contents**

```sql
-- Public view exposing only the safe owner branding columns to anon callers.
-- Eliminates the need for service-role on the customer landing route.

create view public.owner_branding
  with (security_invoker = on)
as
select
  id,
  business_name,
  accent_color,
  cta_text,
  logo_path,
  branding_complete
from public.owners;

grant select on public.owner_branding to anon, authenticated;

-- The view inherits RLS from underlying owners table because of security_invoker.
-- We need an anon-readable policy on owners scoped to the columns the view exposes.
-- Since RLS is row-level not column-level, we add a row-policy that returns the
-- whole row only when branding_complete = true (incomplete owners are hidden anyway).
-- All sensitive columns (auth, email) are NOT in the view's SELECT list.

create policy "anon read complete owner branding"
  on public.owners for select
  to anon
  using (branding_complete = true);
```

Reasoning notes (for reviewers / future maintainers):
- The view uses `security_invoker = on` so RLS is evaluated against the caller's role (anon), not the view's owner. Without this, the view would bypass RLS entirely.
- The new RLS policy on `owners` grants anon row-level read access **only when `branding_complete = true`**. This dovetails with the Phase B inline fix that hid the customer landing for incomplete owners — same protection enforced at two layers.
- Sensitive columns are not in the view's SELECT, so even if the policy granted broader access, anon callers couldn't see them through this view.

- [ ] **Step 3: Apply migration**

```powershell
pnpm exec supabase db push
```

- [ ] **Step 4: Refactor customer landing to use the view via anon client**

Modify `app/(customer)/c/[qrCodeId]/page.tsx`:

Replace the entire file content with:

```tsx
import { notFound } from 'next/navigation';
import { createAnonClient } from '@/lib/supabase/anon';
import { createAdminClient } from '@/lib/supabase/admin';
import { CustomerRecorder } from './customer-recorder';

type Params = { params: Promise<{ qrCodeId: string }> };

export default async function CustomerLanding({ params }: Params) {
  const { qrCodeId } = await params;

  const anon = createAnonClient();

  // Look up QR via anon (qr_codes has anon read RLS).
  const { data: qr } = await anon
    .from('qr_codes')
    .select('id, owner_id, location_label, archived_at')
    .eq('id', qrCodeId)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    notFound();
  }

  // Read owner branding via the public view (anon-readable for complete owners).
  const { data: owner } = await anon
    .from('owner_branding')
    .select('business_name, accent_color, cta_text, logo_path, branding_complete')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner || !owner.branding_complete) {
    notFound();
  }

  // Signed URL for the logo is a server-side operation; admin client is fine here
  // (no sensitive data leaks; signed URLs are intentional).
  let logoUrl: string | null = null;
  if (owner.logo_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60 * 6); // 6 hours
    logoUrl = signed?.signedUrl ?? null;
  }

  return (
    <CustomerRecorder
      qrCodeId={qr.id}
      locationLabel={qr.location_label}
      branding={{
        businessName: owner.business_name,
        accentColor: owner.accent_color,
        ctaText: owner.cta_text,
        logoUrl,
      }}
    />
  );
}
```

Notes:
- The whole UI moves into `CustomerRecorder` (created in Task 13).
- The admin client is still used for the signed logo URL, but only for server-side URL signing — no DB read with service role. The admin import will be flagged for refactor in Phase D when we replace signed URLs with a public read on the logos bucket.

- [ ] **Step 5: Compile**

```powershell
pnpm tsc --noEmit
```

There will be a transient error: `Cannot find module './customer-recorder'`. That's fine — Task 13 creates it.

- [ ] **Step 6: Commit (deferred until Task 13)**

Skip the commit for now — the page references `./customer-recorder` which doesn't exist yet. We'll commit Task 1 + Task 13 together.

---

## Task 2: Storage RLS — videos and thumbnails buckets

Phase A created the `videos` and `thumbnails` buckets but no RLS policies on `storage.objects` for them. Customer uploads happen via service-role (the upload endpoint), so customer-facing writes are not constrained by RLS. But owners need to read their own videos and thumbnails in the (future) inbox — those reads should go through proper RLS.

**Files:**
- Create: `supabase/migrations/<timestamp>_video_storage_rls.sql`

- [ ] **Step 1: Create migration**

```powershell
pnpm exec supabase migration new video_storage_rls
```

- [ ] **Step 2: Write contents**

```sql
-- Storage RLS for `videos` and `thumbnails` buckets.
-- Customer uploads happen server-side via service-role (no INSERT policy needed).
-- Owners read their own files via signed URLs that bypass RLS,
-- but we also add owner self-read policies for direct dashboard reads.

create policy "owners can read own videos"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can delete own videos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can read own thumbnails"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owners can delete own thumbnails"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'thumbnails'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- No INSERT or UPDATE policies on these buckets — all writes go through
-- /api/upload/sign and /api/videos finalize via service role.
```

- [ ] **Step 3: Apply migration**

```powershell
pnpm exec supabase db push
```

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(storage): add RLS policies for videos and thumbnails buckets"
```

---

## Task 3: Consent text constant

A single source of truth for the consent line shown above the Send button, with `{businessName}` substitution. The rendered text gets snapshotted onto each video row at submit time per the spec.

**Files:**
- Create: `lib/consent.ts`

- [ ] **Step 1: Write the helper**

```ts
const TEMPLATE =
  'By sending, you give {businessName} permission to share this video on their social channels.';

export function renderConsentText(businessName: string): string {
  return TEMPLATE.replace('{businessName}', businessName);
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/consent.ts
git commit -m "feat(customer): add consent text helper"
```

---

## Task 4: Browser feature detection helpers

Detect whether the current browser supports MediaRecorder + getUserMedia + a workable mimeType. Done in a separate module so the customer recorder component stays focused on UI state.

**Files:**
- Create: `lib/recorder/browser-support.ts`

- [ ] **Step 1: Write the helpers**

```ts
const CANDIDATE_MIMES = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // iOS Safari 14.5+
  'video/webm;codecs=vp9,opus',              // Chrome/Edge/Firefox
  'video/webm;codecs=vp8,opus',              // Older Chrome
  'video/webm',                              // Last resort
];

export type BrowserSupport =
  | { kind: 'ok'; mimeType: string }
  | { kind: 'no-mediadevices' }
  | { kind: 'no-mediarecorder' }
  | { kind: 'no-supported-mime' };

export function detectBrowserSupport(): BrowserSupport {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return { kind: 'no-mediadevices' };
  }
  if (typeof window === 'undefined' || typeof window.MediaRecorder === 'undefined') {
    return { kind: 'no-mediarecorder' };
  }
  const mimeType = CANDIDATE_MIMES.find((mime) =>
    window.MediaRecorder.isTypeSupported(mime)
  );
  if (!mimeType) {
    return { kind: 'no-supported-mime' };
  }
  return { kind: 'ok', mimeType };
}

export function looksLikeDesktop(): boolean {
  if (typeof window === 'undefined') return false;
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const hasCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return !hasTouch && !hasCoarsePointer;
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/recorder/browser-support.ts
git commit -m "feat(recorder): add browser feature detection"
```

---

## Task 5: MediaRecorder hook

A React hook that wraps MediaRecorder. Single source of truth for camera/mic stream lifecycle, recording start/stop, and produced blob retrieval. Cap bitrate at 2.5 Mbps (per spec — critical for cost).

**Files:**
- Create: `lib/recorder/use-recorder.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

const MAX_DURATION_MS = 30_000;
const VIDEO_BITS_PER_SECOND = 2_500_000;
const AUDIO_BITS_PER_SECOND = 96_000;

export type RecorderState =
  | 'idle'
  | 'requesting-permission'
  | 'ready'
  | 'recording'
  | 'stopped'
  | 'error';

export type RecorderError =
  | { kind: 'permission-denied' }
  | { kind: 'no-camera' }
  | { kind: 'orientation' }
  | { kind: 'other'; message: string };

export type RecorderResult = {
  blob: Blob;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
};

export function useRecorder(mimeType: string) {
  const [state, setState] = useState<RecorderState>('idle');
  const [error, setError] = useState<RecorderError | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [result, setResult] = useState<RecorderResult | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef<number>(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);

  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    videoElRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
    }
  }, []);

  const cleanup = useCallback(() => {
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
    stopTimerRef.current = null;
    tickTimerRef.current = null;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch {}
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    streamRef.current = null;
    if (videoElRef.current) {
      videoElRef.current.srcObject = null;
    }
  }, []);

  useEffect(() => {
    return () => cleanup();
  }, [cleanup]);

  const requestPermission = useCallback(async () => {
    setError(null);
    setState('requesting-permission');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1080 },
          height: { ideal: 1920 },
          aspectRatio: { ideal: 9 / 16 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });
      streamRef.current = stream;
      if (videoElRef.current) {
        videoElRef.current.srcObject = stream;
      }
      setState('ready');
    } catch (err) {
      const e = err as DOMException;
      if (e.name === 'NotAllowedError' || e.name === 'SecurityError') {
        setError({ kind: 'permission-denied' });
      } else if (e.name === 'NotFoundError' || e.name === 'OverconstrainedError') {
        setError({ kind: 'no-camera' });
      } else {
        setError({ kind: 'other', message: e.message || 'Camera error' });
      }
      setState('error');
    }
  }, []);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;

    // Orientation check — bail if the natural sensor orientation is landscape.
    const videoTrack = streamRef.current.getVideoTracks()[0];
    const settings = videoTrack?.getSettings();
    if (settings?.width && settings?.height && settings.width > settings.height) {
      setError({ kind: 'orientation' });
      setState('error');
      return;
    }

    chunksRef.current = [];
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const width = settings?.width ?? 1080;
      const height = settings?.height ?? 1920;
      const durationMs = Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current);
      setResult({ blob, mimeType, durationMs, width, height });
      setState('stopped');
    };

    recorder.onerror = (event) => {
      const e = event as ErrorEvent;
      setError({ kind: 'other', message: e.message || 'Recorder error' });
      setState('error');
    };

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsedMs(0);
    setState('recording');

    // Start with a 1-second timeslice so iOS Safari flushes chunks regularly.
    recorder.start(1000);

    stopTimerRef.current = setTimeout(() => {
      if (recorderRef.current && recorderRef.current.state === 'recording') {
        recorderRef.current.stop();
      }
    }, MAX_DURATION_MS);

    tickTimerRef.current = setInterval(() => {
      setElapsedMs(Math.min(MAX_DURATION_MS, Date.now() - startedAtRef.current));
    }, 100);
  }, [mimeType]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickTimerRef.current) clearInterval(tickTimerRef.current);
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsedMs(0);
    setState('ready');
  }, []);

  return {
    state,
    error,
    elapsedMs,
    result,
    attachPreview,
    requestPermission,
    startRecording,
    stopRecording,
    reset,
  };
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/recorder/use-recorder.ts
git commit -m "feat(recorder): add useRecorder hook with MediaRecorder lifecycle"
```

---

## Task 6: Thumbnail capture helper

Capture a JPEG from a video element via a canvas. Returns a base64 data URL ready to send to the finalize endpoint.

**Files:**
- Create: `lib/recorder/capture-thumbnail.ts`

- [ ] **Step 1: Write the helper**

```ts
const THUMB_WIDTH = 360;
const THUMB_HEIGHT = 640; // 9:16 vertical
const THUMB_QUALITY = 0.82;

/**
 * Capture a JPEG thumbnail from a video blob at a given timestamp.
 * Returns a data URL like 'data:image/jpeg;base64,...'.
 */
export async function captureThumbnail(blob: Blob, atSeconds = 0.1): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error('Failed to load video for thumbnail'));
    });

    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error('Failed to seek video for thumbnail'));
      video.currentTime = Math.min(atSeconds, Math.max(0, video.duration - 0.1));
    });

    const canvas = document.createElement('canvas');
    canvas.width = THUMB_WIDTH;
    canvas.height = THUMB_HEIGHT;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');

    // Cover-fit: preserve aspect, fill the thumb rect.
    const videoAspect = video.videoWidth / video.videoHeight;
    const thumbAspect = THUMB_WIDTH / THUMB_HEIGHT;
    let sx = 0, sy = 0, sw = video.videoWidth, sh = video.videoHeight;
    if (videoAspect > thumbAspect) {
      // video is wider than thumb — crop sides
      sw = video.videoHeight * thumbAspect;
      sx = (video.videoWidth - sw) / 2;
    } else if (videoAspect < thumbAspect) {
      // video is taller than thumb — crop top/bottom
      sh = video.videoWidth / thumbAspect;
      sy = (video.videoHeight - sh) / 2;
    }
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, THUMB_WIDTH, THUMB_HEIGHT);

    return canvas.toDataURL('image/jpeg', THUMB_QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/recorder/capture-thumbnail.ts
git commit -m "feat(recorder): add canvas-based thumbnail capture helper"
```

---

## Task 7: Upload signing API endpoint

Server endpoint that validates the request (QR exists, file size + duration within bounds), pre-creates a `videos` row with `processing_status='uploading'`, snapshots consent text, returns the signed upload URL + video ID.

**Files:**
- Create: `app/api/upload/sign/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add app/api/upload
git commit -m "feat(upload): add signed upload URL endpoint"
```

---

## Task 8: Video finalize API endpoint

Endpoint the client calls after the upload PUT succeeds. Receives the thumbnail dataURL, uploads it to the `thumbnails` bucket, flips the `videos` row to `processing_status='ready'`.

**Files:**
- Create: `app/api/videos/[id]/finalize/route.ts`

- [ ] **Step 1: Write the route**

```ts
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
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add app/api/videos
git commit -m "feat(upload): add video finalize endpoint with thumbnail upload"
```

---

## Task 9: Upload hook (client-side)

Encapsulates the three-step client upload: call /api/upload/sign, PUT the blob, call /api/videos/[id]/finalize.

**Files:**
- Create: `lib/upload/use-upload.ts`

- [ ] **Step 1: Write the hook**

```ts
import { useCallback, useState } from 'react';

export type UploadState = 'idle' | 'signing' | 'uploading' | 'finalizing' | 'done' | 'error';

export type UploadInput = {
  qrCodeId: string;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  width: number;
  height: number;
  thumbnailDataUrl: string;
};

export type UploadHook = {
  state: UploadState;
  progress: number; // 0..1
  errorMessage: string | null;
  upload: (input: UploadInput) => Promise<void>;
  reset: () => void;
};

export function useUpload(): UploadHook {
  const [state, setState] = useState<UploadState>('idle');
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const upload = useCallback(async (input: UploadInput) => {
    setErrorMessage(null);
    setProgress(0);

    try {
      // 1. Sign
      setState('signing');
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qrCodeId: input.qrCodeId,
          mimeType: input.mimeType,
          sizeBytes: input.blob.size,
          durationMs: input.durationMs,
          width: input.width,
          height: input.height,
        }),
      });
      if (!signRes.ok) {
        const j = await safeJson(signRes);
        throw new Error(j?.error ?? `Sign failed (${signRes.status})`);
      }
      const { videoId, uploadUrl } = (await signRes.json()) as {
        videoId: string;
        uploadUrl: string;
      };

      // 2. Upload via XHR (so we get progress events)
      setState('uploading');
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', input.mimeType);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            setProgress(ev.loaded / ev.total);
          }
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setProgress(1);
            resolve();
          } else {
            reject(new Error(`Upload failed (${xhr.status})`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload network error'));
        xhr.ontimeout = () => reject(new Error('Upload timed out'));
        xhr.timeout = 5 * 60 * 1000; // 5 minutes
        xhr.send(input.blob);
      });

      // 3. Finalize
      setState('finalizing');
      const finRes = await fetch(`/api/videos/${videoId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailDataUrl: input.thumbnailDataUrl,
        }),
      });
      if (!finRes.ok) {
        const j = await safeJson(finRes);
        throw new Error(j?.error ?? `Finalize failed (${finRes.status})`);
      }

      setState('done');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      setErrorMessage(message);
      setState('error');
    }
  }, []);

  const reset = useCallback(() => {
    setState('idle');
    setProgress(0);
    setErrorMessage(null);
  }, []);

  return { state, progress, errorMessage, upload, reset };
}

async function safeJson(res: Response): Promise<any | null> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/upload/use-upload.ts
git commit -m "feat(upload): add useUpload client hook"
```

---

## Task 10: Permission-denied state component

Shown when getUserMedia returns NotAllowedError. Gives the customer plain-language instructions to re-enable camera access.

**Files:**
- Create: `components/customer/permission-denied.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { Button } from '@/components/ui/button';

type PermissionDeniedProps = {
  onRetry: () => void;
};

export function PermissionDenied({ onRetry }: PermissionDeniedProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Camera access needed</h2>
      <p className="text-sm text-muted-foreground">
        We need your camera and mic to record a quick clip. Tap the camera icon in
        your browser's address bar to enable it, or open your phone's browser
        settings.
      </p>
      <p className="text-xs text-muted-foreground">
        On iPhone: Settings → Safari → Camera → Allow.
        On Android: tap the lock icon next to the URL → Site settings → Camera → Allow.
      </p>
      <Button onClick={onRetry} variant="outline">
        Try again
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/customer/permission-denied.tsx
git commit -m "feat(customer): add permission-denied state"
```

---

## Task 11: Unsupported-browser state component

Shown when feature detection fails (no MediaRecorder, no getUserMedia, no supported mimeType).

**Files:**
- Create: `components/customer/unsupported-browser.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import type { BrowserSupport } from '@/lib/recorder/browser-support';

type UnsupportedBrowserProps = {
  reason: Exclude<BrowserSupport, { kind: 'ok' }>;
};

export function UnsupportedBrowser({ reason }: UnsupportedBrowserProps) {
  const message =
    reason.kind === 'no-mediadevices'
      ? "Your browser can't access the camera."
      : reason.kind === 'no-mediarecorder'
        ? "Your browser doesn't support video recording."
        : "Your browser can't record video in a supported format.";

  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Update your browser</h2>
      <p className="text-sm text-muted-foreground">{message}</p>
      <p className="text-xs text-muted-foreground">
        Try opening this page in Safari (iPhone) or Chrome (Android). On older
        phones, update your iOS or Chrome to the latest version.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/customer/unsupported-browser.tsx
git commit -m "feat(customer): add unsupported-browser state"
```

---

## Task 12: Desktop-prompt component

Suggest the customer open the page on their phone if they're on desktop.

**Files:**
- Create: `components/customer/desktop-prompt.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { Button } from '@/components/ui/button';

type DesktopPromptProps = {
  onContinueAnyway: () => void;
};

export function DesktopPrompt({ onContinueAnyway }: DesktopPromptProps) {
  return (
    <div className="flex flex-col items-center gap-4 max-w-sm text-center">
      <h2 className="text-xl font-semibold">Open this on your phone</h2>
      <p className="text-sm text-muted-foreground">
        This works best on a phone with a camera. Open this URL on your phone,
        or scan the QR code from your table again.
      </p>
      <Button onClick={onContinueAnyway} variant="outline" size="sm">
        I have a webcam — continue anyway
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add components/customer/desktop-prompt.tsx
git commit -m "feat(customer): add desktop-prompt fallback"
```

---

## Task 13: Customer recorder client component (the orchestrator)

The single client component that runs the entire customer flow. State machine: `landing → permission → recording → preview → sending → thanks` plus error states.

**Files:**
- Create: `app/(customer)/c/[qrCodeId]/customer-recorder.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { DesktopPrompt } from '@/components/customer/desktop-prompt';
import { PermissionDenied } from '@/components/customer/permission-denied';
import { UnsupportedBrowser } from '@/components/customer/unsupported-browser';
import { renderConsentText } from '@/lib/consent';
import { detectBrowserSupport, looksLikeDesktop } from '@/lib/recorder/browser-support';
import { captureThumbnail } from '@/lib/recorder/capture-thumbnail';
import { useRecorder } from '@/lib/recorder/use-recorder';
import { useUpload } from '@/lib/upload/use-upload';

type Stage = 'landing' | 'desktop' | 'permission' | 'recording' | 'preview' | 'sending' | 'thanks';

type Branding = {
  businessName: string;
  accentColor: string;
  ctaText: string | null;
  logoUrl: string | null;
};

type CustomerRecorderProps = {
  qrCodeId: string;
  locationLabel: string | null;
  branding: Branding;
};

export function CustomerRecorder({ qrCodeId, locationLabel, branding }: CustomerRecorderProps) {
  const support = useMemo(() => detectBrowserSupport(), []);
  const isDesktop = useMemo(() => looksLikeDesktop(), []);

  const [stage, setStage] = useState<Stage>(() => (isDesktop ? 'desktop' : 'landing'));
  const recorder = useRecorder(support.kind === 'ok' ? support.mimeType : 'video/webm');
  const upload = useUpload();

  // Auto-advance from permission/requesting to recording-ready prompt.
  useEffect(() => {
    if (stage === 'permission' && recorder.state === 'ready') {
      // Stay in 'permission' UI until user taps "Start recording" — this UI step
      // shows the live preview and explains what's about to happen.
    }
  }, [stage, recorder.state]);

  // When recorder produces a result, move to preview.
  useEffect(() => {
    if (stage === 'recording' && recorder.state === 'stopped' && recorder.result) {
      setStage('preview');
    }
  }, [stage, recorder.state, recorder.result]);

  // When upload finishes, move to thanks.
  useEffect(() => {
    if (stage === 'sending' && upload.state === 'done') {
      setStage('thanks');
    }
  }, [stage, upload.state]);

  // Consent text shown above the Send button.
  const consentText = useMemo(
    () => renderConsentText(branding.businessName),
    [branding.businessName]
  );

  // ---------- Branches that short-circuit the normal flow ----------

  if (support.kind !== 'ok') {
    return (
      <CenterPage>
        <UnsupportedBrowser reason={support} />
      </CenterPage>
    );
  }

  if (stage === 'desktop') {
    return (
      <CenterPage>
        <DesktopPrompt onContinueAnyway={() => setStage('landing')} />
      </CenterPage>
    );
  }

  if (recorder.error?.kind === 'permission-denied') {
    return (
      <CenterPage>
        <PermissionDenied
          onRetry={() => {
            recorder.reset();
            void recorder.requestPermission();
            setStage('permission');
          }}
        />
      </CenterPage>
    );
  }

  // ---------- Main happy-path UI ----------

  if (stage === 'landing') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} locationLabel={locationLabel} />
        <Button
          onClick={() => {
            setStage('permission');
            void recorder.requestPermission();
          }}
          className="rounded-md px-8 py-3 text-base font-medium text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          Start recording
        </Button>
      </CenterPage>
    );
  }

  if (stage === 'permission') {
    return (
      <RecordingStage
        recorder={recorder}
        branding={branding}
        onStart={() => {
          recorder.startRecording();
          setStage('recording');
        }}
        showStartButton
      />
    );
  }

  if (stage === 'recording') {
    return (
      <RecordingStage
        recorder={recorder}
        branding={branding}
        onStart={() => {}}
        showStartButton={false}
      />
    );
  }

  if (stage === 'preview' && recorder.result) {
    return (
      <PreviewStage
        result={recorder.result}
        branding={branding}
        consentText={consentText}
        onRetake={() => {
          recorder.reset();
          setStage('permission');
        }}
        onSaveToDevice={() => downloadBlob(recorder.result!.blob, branding.businessName)}
        onSend={async () => {
          if (!recorder.result) return;
          setStage('sending');
          try {
            const thumb = await captureThumbnail(recorder.result.blob, 0.1);
            await upload.upload({
              qrCodeId,
              blob: recorder.result.blob,
              mimeType: recorder.result.mimeType,
              durationMs: recorder.result.durationMs,
              width: recorder.result.width,
              height: recorder.result.height,
              thumbnailDataUrl: thumb,
            });
          } catch {
            // useUpload populates errorMessage on its own; nothing else to do.
          }
        }}
      />
    );
  }

  if (stage === 'sending') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} compact />
        <p className="text-base text-muted-foreground">
          {upload.state === 'signing' && 'Getting things ready…'}
          {upload.state === 'uploading' && `Sending… ${Math.round(upload.progress * 100)}%`}
          {upload.state === 'finalizing' && 'Almost done…'}
        </p>
        {upload.state === 'error' && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-red-700 text-center max-w-sm">
              {upload.errorMessage ?? 'Something went wrong sending your video.'}
            </p>
            <Button
              onClick={async () => {
                if (!recorder.result) return;
                upload.reset();
                const thumb = await captureThumbnail(recorder.result.blob, 0.1);
                await upload.upload({
                  qrCodeId,
                  blob: recorder.result.blob,
                  mimeType: recorder.result.mimeType,
                  durationMs: recorder.result.durationMs,
                  width: recorder.result.width,
                  height: recorder.result.height,
                  thumbnailDataUrl: thumb,
                });
              }}
            >
              Try again
            </Button>
            <Button variant="ghost" onClick={() => setStage('preview')}>
              Back to preview
            </Button>
          </div>
        )}
      </CenterPage>
    );
  }

  if (stage === 'thanks') {
    return (
      <CenterPage>
        <BrandingHeader branding={branding} compact />
        <h2 className="text-3xl font-bold">Thanks for sharing! 🎉</h2>
        <p className="text-sm text-muted-foreground max-w-sm text-center">
          {branding.businessName} just got your clip. Enjoy your time at the table.
        </p>
      </CenterPage>
    );
  }

  // Fallback (shouldn't happen).
  return <CenterPage><p>Loading…</p></CenterPage>;
}

// ---------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------

function CenterPage({ children }: { children: React.ReactNode }) {
  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center"
      style={{ backgroundColor: '#fafafa' }}
    >
      {children}
    </main>
  );
}

function BrandingHeader({
  branding,
  locationLabel,
  compact,
}: {
  branding: Branding;
  locationLabel?: string | null;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      {branding.logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={branding.logoUrl}
          alt={`${branding.businessName} logo`}
          className={compact ? 'h-12 w-12 rounded-md object-cover' : 'h-24 w-24 rounded-md object-cover'}
        />
      )}
      <h1 className={compact ? 'text-xl font-semibold' : 'text-3xl font-bold'}>
        {branding.businessName}
      </h1>
      {!compact && locationLabel && (
        <p className="text-sm text-muted-foreground">{locationLabel}</p>
      )}
      {!compact && branding.ctaText && (
        <p className="max-w-sm text-base text-muted-foreground">
          {branding.ctaText}
        </p>
      )}
    </div>
  );
}

function RecordingStage({
  recorder,
  branding,
  onStart,
  showStartButton,
}: {
  recorder: ReturnType<typeof useRecorder>;
  branding: Branding;
  onStart: () => void;
  showStartButton: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    recorder.attachPreview(videoRef.current);
    return () => recorder.attachPreview(null);
  }, [recorder]);

  const ringPercent = Math.min(100, (recorder.elapsedMs / 30_000) * 100);

  return (
    <CenterPage>
      <BrandingHeader branding={branding} compact />
      <div className="relative w-full max-w-xs aspect-[9/16] overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {recorder.state === 'recording' && (
          <div className="absolute top-3 left-3 flex items-center gap-2 rounded-full bg-red-600/90 px-3 py-1 text-xs font-semibold text-white">
            <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
            {Math.floor(recorder.elapsedMs / 1000)}s / 30s
          </div>
        )}
      </div>
      {recorder.state === 'recording' && (
        <>
          <div className="h-1 w-full max-w-xs rounded-full bg-muted">
            <div
              className="h-full rounded-full"
              style={{ width: `${ringPercent}%`, backgroundColor: branding.accentColor }}
            />
          </div>
          <Button
            onClick={() => recorder.stopRecording()}
            variant="outline"
            size="lg"
          >
            Stop
          </Button>
        </>
      )}
      {showStartButton && recorder.state === 'ready' && (
        <Button
          onClick={onStart}
          className="rounded-md px-8 py-3 text-base font-medium text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          Record
        </Button>
      )}
      {recorder.error?.kind === 'orientation' && (
        <p className="text-sm text-red-700">Please hold your phone upright (portrait).</p>
      )}
    </CenterPage>
  );
}

function PreviewStage({
  result,
  branding,
  consentText,
  onRetake,
  onSaveToDevice,
  onSend,
}: {
  result: { blob: Blob; mimeType: string };
  branding: Branding;
  consentText: string;
  onRetake: () => void;
  onSaveToDevice: () => void;
  onSend: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    const objectUrl = URL.createObjectURL(result.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [result.blob]);

  return (
    <CenterPage>
      <BrandingHeader branding={branding} compact />
      <div className="w-full max-w-xs aspect-[9/16] overflow-hidden rounded-lg bg-black">
        {url && (
          <video
            src={url}
            autoPlay
            loop
            playsInline
            muted={false}
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <Button variant="outline" onClick={onRetake}>
          Retake
        </Button>
        <Button variant="outline" onClick={onSaveToDevice}>
          Save to device
        </Button>
        <p className="px-2 text-center text-xs text-muted-foreground">
          {consentText}
        </p>
        <Button
          onClick={onSend}
          className="rounded-md px-8 py-3 text-base font-medium text-white"
          style={{ backgroundColor: branding.accentColor }}
        >
          Send to {branding.businessName}
        </Button>
      </div>
    </CenterPage>
  );
}

function downloadBlob(blob: Blob, businessName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const ext = blob.type.startsWith('video/mp4') ? 'mp4' : 'webm';
  a.href = url;
  a.download = `kollab-${businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '')}.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

If there are any TypeScript errors from this large component (it has the most type surface in the project), READ them carefully and fix in place rather than restructuring.

- [ ] **Step 3: Commit (Task 1 + Task 13 together)**

The customer-landing page from Task 1 references this component. Commit both:

```powershell
git add "app/(customer)/c/[qrCodeId]/page.tsx" "app/(customer)/c/[qrCodeId]/customer-recorder.tsx"
git commit -m "feat(customer): wire customer recorder flow with state machine"
```

---

## Task 14: End-to-end Phase C smoke test

Manual verification of the full record-and-send loop.

**Files:** *(no code; manual)*

- [ ] **Step 1: Get the dev server reachable from your phone**

Plain `pnpm dev` binds to `localhost` only, which a phone can't reach. Either:

A) **Same wifi:**

```powershell
pnpm dev --hostname 0.0.0.0
```

Find your machine's LAN IP (`ipconfig` in PowerShell, look for IPv4 Address under your wifi adapter — usually `192.168.x.x`). Open `http://<your-lan-ip>:3000/c/<your-qr-id>` on your phone.

**Important:** browsers REQUIRE HTTPS (or `localhost`) for `getUserMedia` to work. A LAN-IP URL over plain HTTP **will be blocked**. You'll need either:
- Tunnel via `cloudflared` or `ngrok` to get HTTPS (free): e.g., `cloudflared tunnel --url http://localhost:3000`
- Or deploy to Vercel (option B below) for a real HTTPS URL.

B) **Vercel deploy preview** (recommended, cleaner test):

```powershell
pnpm dlx vercel
```

Follow the prompts. After deployment, you get a `*.vercel.app` HTTPS URL. Update Supabase Auth → URL Configuration → Site URL + Additional Redirect URLs to include the Vercel URL so magic links work.

- [ ] **Step 2: Reset the test owner's videos table (optional)**

To start with a clean inbox state, in Supabase SQL editor:

```sql
delete from videos
where owner_id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com');
```

- [ ] **Step 3: Walk the happy path on your phone**

1. Open the customer landing URL (`/c/<qrId>`) on a real phone in Safari (iOS) or Chrome (Android).
2. Expect branded landing: business name, logo, accent-colored "Start recording" button.
3. Tap "Start recording" → browser prompts for camera permission → allow.
4. Expect the camera preview to appear with a "Record" button.
5. Tap "Record" → the preview should start recording, a red badge with elapsed/30s should appear, the progress bar fills as you go.
6. Hit "Stop" before 30s OR let it auto-stop at 30s.
7. Expect the preview screen: video loops, three buttons (Retake, Save to device, Send to [Business Name]) and the consent line above Send.
8. Test "Retake" → goes back to record screen with a fresh permission state.
9. Re-record → "Save to device" → confirm a file downloads to your phone.
10. Re-record → "Send to [Business Name]".
11. Watch the progress UI: "Getting things ready…" → "Sending… X%" → "Almost done…" → "Thanks for sharing! 🎉"

- [ ] **Step 4: Verify the database**

In Supabase SQL editor:

```sql
select id, owner_id, qr_code_id, storage_path, thumbnail_path, mime_type,
       duration_ms, width, height, size_bytes, consent_text_snapshot,
       location_label_snapshot, status, processing_status, ip_hash, created_at
from videos
where owner_id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com')
order by created_at desc
limit 5;
```

Expect at least one row with:
- `processing_status = 'ready'`
- `status = 'new'`
- `storage_path` like `{owner-uuid}/{video-uuid}.mp4` or `.webm`
- `thumbnail_path` like `{owner-uuid}/{video-uuid}.jpg`
- `duration_ms` ≤ 30100 (allowing for tiny overshoot)
- `consent_text_snapshot` containing the business name
- `mime_type` matching the recorded codec
- `ip_hash` populated (SHA-256 hex)

- [ ] **Step 5: Verify the storage objects**

In Supabase Dashboard → Storage:
- `videos` bucket: confirm a file at `{owner-uuid}/{video-uuid}.{ext}` exists, ~5-15MB.
- `thumbnails` bucket: confirm a `.jpg` file at the same path shape, ~10-50KB.

Click the video file → Get URL (signed) → play it. Confirm it's the clip you just recorded.
Click the thumbnail → confirm it's a JPEG snapshot of the video's first frame.

- [ ] **Step 6: Edge case checks (optional but worth it)**

- Visit the customer URL on desktop → expect the "Open this on your phone" page with a "continue anyway" button.
- Deny camera permission on first prompt → expect the permission-denied page with re-enable instructions and Try again button.
- Try the customer URL with a bogus QR ID → expect 404.

- [ ] **Step 7: Tag the phase**

```powershell
git tag -a phase-c-complete -m "Phase C: customer video capture, upload, and finalize complete"
git push origin --tags
```

---

## Phase C — Done

After Task 14 passes you have:

- A working customer recording flow on real phones — scan → record up to 30s vertical → preview → send → thank you, all without an app install
- Capped video file sizes via 2.5 Mbps bitrate (the spec's single most important cost protection)
- Client-side thumbnail capture without server ffmpeg
- Signed-URL upload pipeline with progress tracking and retry-on-error
- A `videos` row per submission with snapshotted consent text and hashed-IP for audit
- The `public.owner_branding` view (Phase B carryover #1) cleanly replacing service-role on the customer route
- Storage RLS policies on `videos` and `thumbnails` ready for the owner inbox in Phase D

**Next:** Phase D — Owner inbox. Owner sees a grid of submissions (thumbnails, status, location label), can play full-screen, download original MP4, soft-delete with 30-day recovery, and toggle status between New / Saved / Hidden. Plan with a separate `writing-plans` invocation when ready.

**Phase C deviations from the spec (for future reference):**
1. **No TUS resumable upload** — used plain signed-URL PUT with retry button. Spec recommended `tus-js-client` against Supabase Storage's TUS endpoint. If real-world upload failure rate proves high in production telemetry, swap in TUS.
2. **No IndexedDB blob stash** — the recorded blob lives in memory only. If the user closes the tab during upload, the recording is lost. Same telemetry trigger as #1: add this if drop-off matters.
3. **`screen.orientation.lock` is NOT called** — the spec mentioned this for Android Chrome. We rely on a runtime check that disables Record if held landscape, plus CSS portrait-locked UI. Lock API is fragile across browsers and adds complexity for marginal benefit.
