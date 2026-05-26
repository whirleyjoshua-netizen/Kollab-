# Kollab v1 — Phase D: Owner Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the owner signs in, they land on a real inbox: a grid of video thumbnails (newest first) showing every submission. Tapping a thumbnail opens a full-screen player with Download, Delete (soft, 30-day recovery), and a status toggle (New / Saved / Hidden). The capture-to-inbox loop closes — they can actually USE the videos diners send.

**Architecture:** The dashboard becomes a Server Component that paginates videos for the signed-in owner via the existing RLS-restricted `videos` table, generates short-lived signed URLs for thumbnails server-side, and hands a typed list to a Client Component for the grid + "Load more" interactivity. The video detail page lives at `/dashboard/video/[id]` — a Server Component that fetches one video + signs URLs for the playback + thumbnail, with mutations (status change, soft delete) and download via server actions. Download uses Supabase's signed-URL `download` option to set `Content-Disposition: attachment` cleanly.

**Tech Stack:** Next.js 16 App Router (server components for data fetch + render, client components for interactivity), Supabase server client (RLS-scoped reads), Supabase admin client (signed URL generation), server actions for mutations, shadcn/ui for the table-of-thumbnails layout.

**Reference spec:** `docs/superpowers/specs/2026-05-19-kollab-v1-design.md`
**Predecessor plans:**
- Phase A: `docs/superpowers/plans/2026-05-19-kollab-v1-phase-a-foundation.md` (`phase-a-complete`)
- Phase B: `docs/superpowers/plans/2026-05-22-kollab-v1-phase-b-onboarding.md` (`phase-b-complete`)
- Phase C: `docs/superpowers/plans/2026-05-22-kollab-v1-phase-c-customer-capture.md` (`phase-c-complete`)

**Phase D carryovers from Phase C review (addressed in this plan):**
- Task 1: add `processing_status` to the videos inbox index
- Task 2: add HMAC token gate on the finalize endpoint
- Task 13 (doc): JSDoc on `useRecorder.reset` clarifying its contract

---

## Task 1: Carryover — inbox index migration

Phase A created `videos_owner_status_idx ON videos(owner_id, status) WHERE deleted_at IS NULL`. The inbox query filters on `processing_status = 'ready'` too (to hide stuck uploads). Add the column to the index so the scan stays fast.

**Files:**
- Create: `supabase/migrations/<timestamp>_videos_inbox_index.sql`

- [ ] **Step 1: Create migration**

```powershell
pnpm exec supabase migration new videos_inbox_index
```

- [ ] **Step 2: Write contents**

```sql
-- Replace videos_owner_status_idx with one that also covers processing_status.
-- The inbox query is: SELECT ... FROM videos
--   WHERE owner_id = $1 AND processing_status = 'ready' AND deleted_at IS NULL
--   ORDER BY created_at DESC LIMIT N OFFSET M
-- The existing videos_owner_created_idx handles the ORDER BY; this one
-- covers the WHERE filter selectivity.

drop index if exists videos_owner_status_idx;

create index videos_owner_inbox_idx
  on videos(owner_id, processing_status, status)
  where deleted_at is null;
```

- [ ] **Step 3: Apply**

```powershell
pnpm exec supabase db push
```

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(db): replace inbox index to include processing_status"
```

---

## Task 2: Carryover — HMAC token on finalize endpoint

Right now `/api/videos/[id]/finalize` accepts any UUID and flips the row to `ready`. An attacker who enumerated valid IDs could pollute an owner's inbox. Add a signed token issued by `/api/upload/sign` and required at finalize.

**Files:**
- Create: `lib/upload/finalize-token.ts`
- Modify: `app/api/upload/sign/route.ts`
- Modify: `app/api/videos/[id]/finalize/route.ts`
- Modify: `lib/upload/use-upload.ts`

- [ ] **Step 1: Add the secret to env vars**

Open `C:\Users\whirl\kollab_ai\.env.local` and add a new line (real value):

```dotenv
FINALIZE_SECRET=<generate-a-random-64-char-hex-string>
```

To generate a random secret, run in PowerShell:

```powershell
[System.BitConverter]::ToString((1..32 | ForEach-Object { Get-Random -Maximum 256 })) -replace '-',''
```

(Or use any other source — Bitwarden's generator, `openssl rand -hex 32`, etc.)

Also add the placeholder to `.env.example`:

```dotenv
# Server-only secret for HMACing video finalize tokens.
FINALIZE_SECRET=replace-with-64-hex-chars
```

- [ ] **Step 2: Write the token helpers**

Create `C:\Users\whirl\kollab_ai\lib\upload\finalize-token.ts`:

```ts
import { createHmac, timingSafeEqual } from 'crypto';

const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 minutes — generous for slow uploads

function secret(): string {
  const s = process.env.FINALIZE_SECRET;
  if (!s) throw new Error('FINALIZE_SECRET env var is not set');
  return s;
}

/**
 * Build a token tied to (videoId, expiry). Expiry is encoded into the
 * token so verification doesn't need server state.
 */
export function issueFinalizeToken(videoId: string): string {
  const expiry = Date.now() + TOKEN_TTL_MS;
  const payload = `${videoId}.${expiry}`;
  const sig = createHmac('sha256', secret()).update(payload).digest('hex');
  return `${expiry}.${sig}`;
}

/**
 * Verify a token issued for videoId. Returns true if signature matches
 * and expiry is in the future.
 */
export function verifyFinalizeToken(videoId: string, token: string): boolean {
  const [expiryStr, providedSig] = token.split('.');
  if (!expiryStr || !providedSig) return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || expiry < Date.now()) return false;

  const payload = `${videoId}.${expiry}`;
  const expectedSig = createHmac('sha256', secret()).update(payload).digest('hex');

  const a = Buffer.from(providedSig, 'hex');
  const b = Buffer.from(expectedSig, 'hex');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 3: Issue the token in the sign endpoint**

In `C:\Users\whirl\kollab_ai\app\api\upload\sign\route.ts`, after the signed upload URL is generated, add the token to the response.

Find this block at the end:

```ts
  return NextResponse.json({
    videoId: video.id,
    storagePath,
    uploadUrl: signed.signedUrl,
    token: signed.token,
  });
}
```

Replace with:

```ts
  const finalizeToken = issueFinalizeToken(video.id);

  return NextResponse.json({
    videoId: video.id,
    storagePath,
    uploadUrl: signed.signedUrl,
    uploadToken: signed.token,
    finalizeToken,
  });
}
```

Also add the import at the top of the file (with the other imports):

```ts
import { issueFinalizeToken } from '@/lib/upload/finalize-token';
```

(Renamed `token` to `uploadToken` so it doesn't get confused with `finalizeToken` — the existing client doesn't read either, so the rename is safe.)

- [ ] **Step 4: Verify the token in the finalize endpoint**

In `C:\Users\whirl\kollab_ai\app\api\videos\[id]\finalize\route.ts`, extend the request schema and add the verification.

Find the schema:

```ts
const RequestSchema = z.object({
  thumbnailDataUrl: z.string().regex(/^data:image\/jpeg;base64,/),
});
```

Replace with:

```ts
const RequestSchema = z.object({
  thumbnailDataUrl: z.string().regex(/^data:image\/jpeg;base64,/),
  finalizeToken: z.string().min(1),
});
```

Add the import at the top:

```ts
import { verifyFinalizeToken } from '@/lib/upload/finalize-token';
```

Add the verification right after the `parsed` block (and before the `createAdminClient` call):

```ts
  if (!verifyFinalizeToken(id, parsed.data.finalizeToken)) {
    return NextResponse.json({ error: 'Invalid or expired finalize token' }, { status: 401 });
  }
```

- [ ] **Step 5: Send the token from the client**

In `C:\Users\whirl\kollab_ai\lib\upload\use-upload.ts`, capture the new token from the sign response and send it with the finalize POST.

Find this block (right after the sign fetch):

```ts
      const { videoId, uploadUrl } = (await signRes.json()) as {
        videoId: string;
        uploadUrl: string;
      };
```

Replace with:

```ts
      const { videoId, uploadUrl, finalizeToken } = (await signRes.json()) as {
        videoId: string;
        uploadUrl: string;
        finalizeToken: string;
      };
```

Find the finalize fetch:

```ts
      const finRes = await fetch(`/api/videos/${videoId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailDataUrl: input.thumbnailDataUrl,
        }),
      });
```

Replace with:

```ts
      const finRes = await fetch(`/api/videos/${videoId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          thumbnailDataUrl: input.thumbnailDataUrl,
          finalizeToken,
        }),
      });
```

- [ ] **Step 6: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 7: Commit**

```powershell
git add lib/upload "app/api/upload/sign/route.ts" "app/api/videos/[id]/finalize/route.ts" .env.example
git commit -m "feat(upload): HMAC-protect the finalize endpoint"
```

(Don't commit `.env.local` — it's gitignored anyway.)

---

## Task 3: Carryover — `useRecorder.reset` JSDoc

Quick doc-only fix per the Phase C review note.

**Files:**
- Modify: `lib/recorder/use-recorder.ts`

- [ ] **Step 1: Add the JSDoc**

In `lib/recorder/use-recorder.ts`, find:

```ts
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsedMs(0);
    setState('ready');
  }, []);
```

Replace with:

```ts
  /**
   * Reset internal state so the next recording can begin. NOTE: this does
   * NOT re-acquire the camera stream. If cleanup() ran (e.g., on a stream
   * error or after permission was revoked), call requestPermission() again
   * before startRecording(). The customer recorder's Retake path does this
   * sequence; new flows should follow the same pattern.
   */
  const reset = useCallback(() => {
    setResult(null);
    setError(null);
    setElapsedMs(0);
    setState('ready');
  }, []);
```

- [ ] **Step 2: Commit**

```powershell
git add lib/recorder/use-recorder.ts
git commit -m "docs(recorder): clarify reset() does not re-request permission"
```

---

## Task 4: Inbox data layer

A focused helper that fetches a page of videos for the signed-in owner. Used by the dashboard page and (later, if needed) any inbox-style routes.

**Files:**
- Create: `lib/videos/list.ts`

- [ ] **Step 1: Write the helper**

Create `C:\Users\whirl\kollab_ai\lib\videos\list.ts`:

```ts
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
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/videos/list.ts
git commit -m "feat(inbox): add fetchInboxPage helper"
```

---

## Task 5: Status badge component

Reused on inbox tiles and the video detail page.

**Files:**
- Create: `components/owner/status-badge.tsx`

- [ ] **Step 1: Write the component**

```tsx
import type { Database } from '@/lib/db/types';

type Status = Database['public']['Enums']['video_status'];

const STYLES: Record<Status, { bg: string; fg: string; label: string }> = {
  new: { bg: 'bg-blue-100', fg: 'text-blue-900', label: 'New' },
  saved: { bg: 'bg-amber-100', fg: 'text-amber-900', label: 'Saved' },
  hidden: { bg: 'bg-zinc-200', fg: 'text-zinc-700', label: 'Hidden' },
};

export function StatusBadge({ status }: { status: Status }) {
  const { bg, fg, label } = STYLES[status];
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${bg} ${fg}`}
    >
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Compile + commit**

```powershell
pnpm tsc --noEmit
git add components/owner/status-badge.tsx
git commit -m "feat(inbox): add status badge"
```

---

## Task 6: Inbox grid client component

Renders the grid of thumbnails and the "Load more" button. Receives the initial page from the Server Component and fetches subsequent pages via a server action.

**Files:**
- Create: `app/(owner)/dashboard/inbox-grid.tsx`
- Create: `app/(owner)/dashboard/inbox-actions.ts`

- [ ] **Step 1: Write the load-more server action**

Create `C:\Users\whirl\kollab_ai\app\(owner)\dashboard\inbox-actions.ts`:

```ts
'use server';

import { fetchInboxPage, type InboxPage } from '@/lib/videos/list';

export async function loadMoreInbox(page: number): Promise<InboxPage> {
  return fetchInboxPage(page);
}
```

- [ ] **Step 2: Write the grid client component**

Create `C:\Users\whirl\kollab_ai\app\(owner)\dashboard\inbox-grid.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/owner/status-badge';
import type { InboxPage, InboxVideo } from '@/lib/videos/list';
import { loadMoreInbox } from './inbox-actions';

type InboxGridProps = {
  initial: InboxPage;
};

export function InboxGrid({ initial }: InboxGridProps) {
  const [videos, setVideos] = useState<InboxVideo[]>(initial.videos);
  const [hasMore, setHasMore] = useState(initial.hasMore);
  const [page, setPage] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function loadMore() {
    setError(null);
    startTransition(async () => {
      try {
        const next = await loadMoreInbox(page + 1);
        setVideos((prev) => [...prev, ...next.videos]);
        setHasMore(next.hasMore);
        setPage((p) => p + 1);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load more');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {videos.map((video) => (
          <InboxTile key={video.id} video={video} />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <Button onClick={loadMore} disabled={isPending} variant="outline">
            {isPending ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-700 text-center">{error}</p>}
    </div>
  );
}

function InboxTile({ video }: { video: InboxVideo }) {
  const date = new Date(video.createdAt);
  const dateLabel = date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const durationLabel =
    video.durationMs && video.durationMs > 0
      ? `${Math.round(video.durationMs / 1000)}s`
      : null;

  return (
    <Link
      href={`/dashboard/video/${video.id}`}
      className="group block overflow-hidden rounded-md border bg-black hover:shadow-md transition-shadow"
    >
      <div className="relative aspect-[9/16] bg-zinc-900">
        {video.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={video.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            No preview
          </div>
        )}
        <div className="absolute top-2 left-2">
          <StatusBadge status={video.status} />
        </div>
        {durationLabel && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            {durationLabel}
          </div>
        )}
      </div>
      <div className="p-2 text-xs bg-white text-foreground">
        <div className="truncate">{dateLabel}</div>
        {video.locationLabel && (
          <div className="truncate text-muted-foreground">{video.locationLabel}</div>
        )}
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Compile + commit**

```powershell
pnpm tsc --noEmit
git add "app/(owner)/dashboard/inbox-grid.tsx" "app/(owner)/dashboard/inbox-actions.ts"
git commit -m "feat(inbox): add grid component with pagination"
```

---

## Task 7: Empty state component

Shown when the owner has zero videos. Reminds them to share their QR.

**Files:**
- Create: `app/(owner)/dashboard/inbox-empty.tsx`

- [ ] **Step 1: Write the component**

```tsx
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

type InboxEmptyProps = {
  qrCodeId: string;
  customerUrl: string;
};

export function InboxEmpty({ qrCodeId, customerUrl }: InboxEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-6 rounded-lg border border-dashed bg-white p-8 text-center">
      <div className="text-4xl">📹</div>
      <h2 className="text-xl font-semibold">No videos yet</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Print your QR code and place it where customers can see it — on tables,
        receipts, or windows. When a customer scans and shares a video, it shows
        up here.
      </p>

      <div className="flex flex-col items-center gap-2">
        <p className="text-xs text-muted-foreground break-all">
          Customer page: <code className="font-mono">{customerUrl}</code>
        </p>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <a href={`/api/qr/${qrCodeId}/pdf?size=letter`} download>
              Download QR (Letter)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={`/api/qr/${qrCodeId}/pdf?size=a4`} download>
              Download QR (A4)
            </a>
          </Button>
        </div>
        <Link
          href={customerUrl}
          target="_blank"
          className="text-sm underline text-muted-foreground"
        >
          Preview the customer experience →
        </Link>
      </div>
    </div>
  );
}
```

**IMPORTANT:** The project's `Button` component (base-ui under the hood, as we discovered in Phase B Task 15) does not support `asChild`. If `pnpm tsc --noEmit` complains, replace the two `<Button asChild variant="outline">` wrappers with plain anchor tags styled via `buttonVariants({ variant: 'outline' })`:

```tsx
import { buttonVariants } from '@/components/ui/button';

// ...
<a href={`/api/qr/${qrCodeId}/pdf?size=letter`} download className={buttonVariants({ variant: 'outline' })}>
  Download QR (Letter)
</a>
```

- [ ] **Step 2: Compile + commit**

```powershell
pnpm tsc --noEmit
git add "app/(owner)/dashboard/inbox-empty.tsx"
git commit -m "feat(inbox): add empty state with QR PDF download"
```

---

## Task 8: Replace dashboard page with real inbox

Wires the data + grid + empty state into a real dashboard page.

**Files:**
- Modify (overwrite): `app/(owner)/dashboard/page.tsx`

- [ ] **Step 1: Overwrite the placeholder**

Replace the entire content of `C:\Users\whirl\kollab_ai\app\(owner)\dashboard\page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { fetchInboxPage } from '@/lib/videos/list';
import { getQrCodeUrl } from '@/lib/qr';
import { signOut } from './actions';
import { InboxGrid } from './inbox-grid';
import { InboxEmpty } from './inbox-empty';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner?.branding_complete) {
    redirect('/onboarding/step-1');
  }

  // Get the owner's default QR (for empty-state guidance + customer URL preview).
  const { data: defaultQr } = await supabase
    .from('qr_codes')
    .select('id')
    .eq('owner_id', userData.user.id)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  const initialPage = await fetchInboxPage(0);

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-baseline gap-3">
            <h1 className="text-lg font-semibold">{owner.business_name}</h1>
            <span className="text-xs text-muted-foreground">Inbox</span>
          </div>
          <form action={signOut}>
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        {initialPage.videos.length === 0 ? (
          defaultQr ? (
            <InboxEmpty
              qrCodeId={defaultQr.id}
              customerUrl={getQrCodeUrl(defaultQr.id)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              No QR code found. Try refreshing — your default QR is created during onboarding.
            </p>
          )
        ) : (
          <InboxGrid initial={initialPage} />
        )}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/dashboard/page.tsx"
git commit -m "feat(dashboard): replace placeholder with real inbox"
```

---

## Task 9: Video detail server actions

The detail page needs three mutations: status update, soft delete, and a download signer (returns a signed URL with `Content-Disposition: attachment`).

**Files:**
- Create: `app/(owner)/dashboard/video/[id]/actions.ts`

- [ ] **Step 1: Write the actions**

```ts
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

async function getOwnerAndVerifyVideo(videoId: string): Promise<{ ownerId: string; storagePath: string; mimeType: string } | { error: string }> {
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

  const ext = check.mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';
  const slug = businessName.replace(/[^a-z0-9-]+/gi, '-').toLowerCase().replace(/-+/g, '-').replace(/^-|-$/g, '');
  const filename = `kollab-${slug || 'video'}-${videoId.slice(0, 8)}.${ext}`;

  const admin = createAdminClient();
  const { data: signed, error: signError } = await admin.storage
    .from('videos')
    .createSignedUrl(check.storagePath, 60 * 5, { download: filename }); // 5 minutes

  if (signError || !signed) return { status: 'error', message: signError?.message ?? 'Could not sign URL' };

  return { status: 'ok', data: signed.signedUrl };
}
```

- [ ] **Step 2: Compile + commit**

```powershell
pnpm tsc --noEmit
git add "app/(owner)/dashboard/video/[id]/actions.ts"
git commit -m "feat(inbox): add video detail actions (status, delete, download)"
```

---

## Task 10: Video detail page

Server Component that fetches the video + signs URLs, hands off to a Client Component for the player and controls.

**Files:**
- Create: `app/(owner)/dashboard/video/[id]/page.tsx`
- Create: `app/(owner)/dashboard/video/[id]/video-detail.tsx`

- [ ] **Step 1: Write the Server Component**

Create `C:\Users\whirl\kollab_ai\app\(owner)\dashboard\video\[id]\page.tsx`:

```tsx
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
```

- [ ] **Step 2: Write the Client Component**

Create `C:\Users\whirl\kollab_ai\app\(owner)\dashboard\video\[id]\video-detail.tsx`:

```tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/owner/status-badge';
import type { Database } from '@/lib/db/types';
import { getDownloadUrl, softDeleteVideo, updateStatus } from './actions';

type Status = Database['public']['Enums']['video_status'];

type VideoDetailProps = {
  video: {
    id: string;
    videoUrl: string;
    mimeType: string;
    durationMs: number | null;
    status: Status;
    createdAt: string;
    locationLabel: string | null;
    consentText: string;
    sizeBytes: number | null;
  };
  businessName: string;
};

export function VideoDetail({ video, businessName }: VideoDetailProps) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(video.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const date = new Date(video.createdAt);
  const dateLabel = date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  const sizeLabel =
    video.sizeBytes && video.sizeBytes > 0
      ? `${(video.sizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : null;
  const durationLabel =
    video.durationMs && video.durationMs > 0
      ? `${Math.round(video.durationMs / 1000)}s`
      : null;

  function handleStatusChange(next: Status) {
    setError(null);
    setStatus(next); // optimistic
    startTransition(async () => {
      const result = await updateStatus(video.id, next);
      if (result.status === 'error') {
        setError(result.message);
        setStatus(video.status); // revert
      }
    });
  }

  function handleDelete() {
    if (!confirm('Move this video to trash? You can recover it within 30 days.')) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await softDeleteVideo(video.id);
      if (result.status === 'error') {
        setError(result.message);
      } else {
        router.push('/dashboard');
      }
    });
  }

  function handleDownload() {
    setError(null);
    startTransition(async () => {
      const result = await getDownloadUrl(video.id, businessName);
      if (result.status === 'error') {
        setError(result.message);
      } else {
        // Trigger the download by setting location — the signed URL has
        // Content-Disposition: attachment so the browser downloads instead
        // of navigating.
        window.location.href = result.data;
      }
    });
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm underline text-muted-foreground">
            ← Inbox
          </Link>
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="mx-auto grid max-w-4xl gap-6 px-4 py-6 md:grid-cols-[2fr,1fr]">
        <div className="overflow-hidden rounded-lg bg-black">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={video.videoUrl}
            controls
            playsInline
            className="w-full aspect-[9/16] object-contain"
          />
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground">Submitted</h3>
            <p className="text-sm">{dateLabel}</p>
            {video.locationLabel && (
              <p className="text-sm text-muted-foreground">{video.locationLabel}</p>
            )}
            <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
              {durationLabel && <span>{durationLabel}</span>}
              {sizeLabel && <span>· {sizeLabel}</span>}
              <span>· {video.mimeType.split(';')[0]}</span>
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Status</h3>
            <div className="flex gap-1">
              {(['new', 'saved', 'hidden'] as Status[]).map((s) => (
                <Button
                  key={s}
                  type="button"
                  variant={status === s ? 'default' : 'outline'}
                  size="sm"
                  disabled={isPending}
                  onClick={() => handleStatusChange(s)}
                  className="flex-1 capitalize"
                >
                  {s}
                </Button>
              ))}
            </div>
          </div>

          <div className="rounded-md border bg-white p-4">
            <h3 className="text-sm font-medium text-muted-foreground mb-2">Actions</h3>
            <div className="flex flex-col gap-2">
              <Button type="button" variant="outline" disabled={isPending} onClick={handleDownload}>
                Download
              </Button>
              <Button type="button" variant="outline" disabled={isPending} onClick={handleDelete} className="text-red-700">
                Delete
              </Button>
            </div>
          </div>

          <details className="rounded-md border bg-white p-4 text-xs">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground">
              Consent text shown to customer
            </summary>
            <p className="mt-2 text-muted-foreground">{video.consentText}</p>
          </details>

          {error && <p className="text-sm text-red-700">{error}</p>}
        </aside>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Compile + commit**

```powershell
pnpm tsc --noEmit
git add "app/(owner)/dashboard/video"
git commit -m "feat(inbox): add video detail page with player and controls"
```

---

## Task 11: End-to-end Phase D smoke test

**Files:** *(no code; manual)*

- [ ] **Step 1: Make sure both `pnpm dev` and the cloudflared tunnel are running**

(Same setup as Phase C smoke test. The customer record flow needs the HTTPS tunnel; the owner inbox can be tested on localhost in your laptop browser.)

- [ ] **Step 2: Make sure there's at least one video in the inbox**

From your phone over the cloudflared tunnel, record + send another video for `culturalarchitectscollective@gmail.com`. Verify it lands in the `videos` table:

```sql
select id, processing_status, status, created_at
from videos
where owner_id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com')
order by created_at desc limit 5;
```

You should see at least one row with `processing_status = 'ready'`. If not, the upload flow is broken and Phase C smoke needs to pass first.

- [ ] **Step 3: Sign in to the dashboard on your laptop**

http://localhost:3000 → Sign in → magic link → land on `/dashboard`.

Expect:
- Header with your business name + "Inbox" label + Sign out button
- Grid of thumbnails (if you have videos) — 2 columns on mobile, more on desktop
- Each tile shows: thumbnail, status badge (top-left), duration (bottom-right), date below

If empty:
- The empty state with QR download buttons + preview link should render

- [ ] **Step 4: Open a video**

Click a thumbnail → navigates to `/dashboard/video/<id>`.

Expect:
- Back link to inbox
- Video player on the left (or top on mobile) — playable, with controls
- Right sidebar with: Submitted date / location label, Status toggle (3 buttons), Action buttons (Download, Delete), Consent text in a collapsible

Play the video. Confirm it's the clip you sent from your phone.

- [ ] **Step 5: Change status**

Click "Saved". The active button highlights. Refresh — status persists. Inbox grid shows the new badge.

Click "Hidden". Same — persists, badge updates.

Click "New" again. Back to default.

- [ ] **Step 6: Download**

Click "Download". Browser triggers a file download named like `kollab-bellas-italian-abc123de.mp4` (or .webm depending on your phone). Open the downloaded file — confirm it plays.

- [ ] **Step 7: Soft delete**

Click "Delete". Confirm the prompt. You should be redirected to the inbox. The video should be gone from the grid.

Verify in DB:

```sql
select id, deleted_at
from videos
where id = '<the-video-id>';
```

Expect `deleted_at` is set (not null).

- [ ] **Step 8: Verify pagination (only if you have 25+ videos — skip if not)**

If you've recorded 25+ videos, the inbox should show 24 thumbnails plus a "Load more" button. Tap → loads the next page.

- [ ] **Step 9: Tag the phase**

```powershell
git tag -a phase-d-complete -m "Phase D: owner inbox with detail, status, download, delete"
git push origin main
git push origin --tags
```

---

## Phase D — Done

You now have:
- A real owner inbox with thumbnails, status, location label, duration
- Pagination via "Load more"
- A clean empty state that drives QR re-download
- Full-screen video player with the actual recorded clip
- Status toggle (New / Saved / Hidden), soft-delete with confirmation, signed-URL download with proper filename
- HMAC-protected finalize endpoint (Phase C carryover closed)
- Inbox index extended to cover `processing_status` (Phase C carryover closed)

**Next:** Phase E — Notifications & polish. Owner gets a (debounced) email when new videos arrive. Plus the daily soft-delete purge job and small UX polish items. Then later: billing (Stripe), the auto-stitcher, and watermarked downloads — the things parked in the original v1 spec.

**Phase D deviations (none of significance):**
- Status filter UI deferred (the badge alone is enough at v1 volumes; if owners ask for a "show hidden only" toggle, add tabs).
- No bulk actions (delete multiple, set status on multiple). Defer until owners report needing it.
