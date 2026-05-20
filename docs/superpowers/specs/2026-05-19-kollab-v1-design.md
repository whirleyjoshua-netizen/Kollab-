# Kollab v1 — Design Spec

**Status:** Draft for review
**Date:** 2026-05-19
**Owner:** @whirl

---

## 1. Context

Restaurants and similar venues rely on static photos on Yelp, Google, and Instagram to represent the in-person experience. Photos miss vibe, motion, sound, and energy. Owners want short-form video for social, but creating it themselves is expensive and inauthentic; the people best positioned to capture it — the diners actually there — have no easy way to share it.

Kollab is a no-install web app that closes that loop. A diner scans a QR code on the table, records up to 30 seconds, and the clip lands directly in the restaurant owner's inbox. Owners get a stream of authentic, in-the-moment UGC they can use anywhere.

The full product vision includes auto-stitching clips into cinematic reels, owner-configured perks ("Show this for a free dessert"), and subscription billing. **v1 deliberately ships the thinnest slice that proves the capture-to-inbox loop works.** Stitching is parked — owners can take the raw clips to CapCut for v1. If the slice is magical enough on its own, every parked feature gets easier to sell.

---

## 2. v1 Scope

> **A customer scans a QR code → records a short video on their phone (no app install) → the video lands in the restaurant owner's inbox where they can view, save, and download it.**

**In scope:**
- Owner sign-up, onboarding, branding setup
- QR code generation (with optional per-location labels)
- Customer landing page (branded per owner)
- In-browser video recording (up to 30s, vertical)
- Send-to-owner upload flow with consent
- Owner inbox with view, status (New/Saved/Hidden), download, soft delete
- Email notifications when new videos arrive

**Explicitly out of scope (parked for v2+):**
- Auto-stitching / cinematic templates
- Owner-configured perks
- Subscription billing
- Watermarked downloads (Pro plan feature)
- Location-based filtering in inbox
- Multi-user / team roles
- Push / SMS notifications
- Direct social posting (IG / TikTok / Google / Yelp)
- Customer-side accounts ("save my submissions to my own gallery")

---

## 3. Customer Flow

1. Diner scans the QR code with their phone camera → opens a web URL: `https://kollab.app/c/{qrCodeId}`.
2. **Branded landing page** loads, showing:
   - Owner's logo
   - Business name
   - Optional one-line CTA (e.g., *"Share up to 30 seconds of your experience at Bella's"*)
   - Owner's accent color
   - Big primary button: **"Start recording"**
3. Tap → browser asks for camera permission → record screen.
4. Records up to **30 seconds**, vertical (9:16) only, with a visible countdown ring. No filters, no editing.
5. **Preview screen** — recorded video auto-loops with three buttons:
   - `Retake` — discard and re-record
   - `Save to device` — downloads the file (iOS: to Files app, not Photos — browser limitation; Android: to Downloads / can be moved to gallery)
   - `Send to [Business Name]` — primary action
6. Above the Send button (plain visible text, not a checkbox):
   > *By sending, you give [Business Name] permission to share this video on their social channels.*
7. Tap Send → upload begins (resumable, with progress) → "Thanks for sharing! 🎉" screen → done.

**Customer never creates an account. Fully anonymous.**

---

## 4. Owner Flow

### Sign-up & onboarding (first-time)

1. Owner visits `/login`, enters email, gets a magic link.
2. Clicks link → lands in onboarding step 1.
3. **Step 1 — Business basics:** business name, optional CTA, accent color picker.
4. **Step 2 — Logo upload:** drag-and-drop, PNG/JPG, square crop suggested.
5. **Step 3 — Your QR is ready:**
   - Preview customer experience (opens landing page in new tab)
   - Download print-ready PDF (Letter / A4 variants)
6. After step 3, future logins land directly on the dashboard.

### Daily use (dashboard = inbox)

- **Grid of video thumbnails, newest first.**
- Each tile shows: thumbnail, timestamp, optional location label, status badge.
- **Status values:** `New` (badge until viewed), `Saved` (owner-starred), `Hidden` (soft-removed from default view).
- Tap thumbnail → full-screen player with:
  - `Download` — MP4 (no watermark in v1)
  - `Delete` — soft delete, recoverable within 30 days
  - Status toggle (New → Saved → Hidden)
- **Email notification** when new videos arrive (debounced — see §10).

### QR provisioning

- Every owner gets one **default QR** automatically at end of onboarding.
- Owner can optionally generate additional QRs labeled with a `location_label` (e.g., "Patio Table 7"). Label is captured but not used for filtering in v1.

---

## 5. Consent & Legal

Customer hands over rights at the moment of tapping Send. The visible plain-language line above the button:

> *By sending, you give [Business Name] permission to share this video on their social channels.*

Implementation: a single constant template string lives in app code (`lib/consent.ts`), with `{businessName}` substituted at render time. At submit, the **fully rendered** text is snapshotted onto `videos.consent_text_snapshot`, so future template changes can't retroactively alter what any given customer agreed to. Per-owner consent customization is not a v1 feature.

GDPR-defensive: also store `created_at` and a hashed IP on each video. Not exposed to owners; available for any future legal request.

---

## 6. Architecture

### Stack

- **Frontend + backend:** Next.js 14+ (App Router, TypeScript). Single codebase for customer landing + owner dashboard. Next.js API routes for backend.
- **Database + Auth + Storage:** Supabase (Postgres + Supabase Auth with magic links + Supabase Storage).
- **Email:** Resend, configured as Supabase Auth's SMTP provider and for transactional notification emails.
- **Hosting:** Vercel (app), Supabase (backend).
- **Key libraries:** `@supabase/ssr`, `qrcode`, `@react-pdf/renderer`, `@react-email/components`, `nanoid`, `tus-js-client`.

### Project layout

```
kollab_ai/
├─ app/
│  ├─ (marketing)/page.tsx              # public landing for owners
│  ├─ (customer)/c/[qrCodeId]/
│  │  ├─ page.tsx                       # branded landing
│  │  ├─ record/page.tsx                # camera UI
│  │  └─ thanks/page.tsx
│  ├─ (owner)/
│  │  ├─ login/page.tsx
│  │  ├─ auth/callback/route.ts         # magic-link landing
│  │  ├─ onboarding/step-{1,2,3}/page.tsx
│  │  └─ dashboard/
│  │     ├─ page.tsx                    # inbox grid
│  │     ├─ video/[id]/page.tsx
│  │     └─ settings/page.tsx
│  └─ api/
│     ├─ upload/sign/route.ts           # signed upload URL
│     ├─ videos/route.ts                # finalize after upload
│     ├─ videos/[id]/route.ts           # DELETE soft
│     └─ qr/[id]/pdf/route.ts           # print-ready PDF
├─ components/{ui,customer,owner}/
├─ lib/
│  ├─ supabase/{client,server,admin}.ts
│  ├─ recorder/                         # MediaRecorder wrapper
│  ├─ email/templates/
│  └─ db/types.ts                       # generated from Supabase
├─ middleware.ts                        # session refresh + route gating
└─ supabase/migrations/*.sql
```

Route groups `(customer)` and `(owner)` give independent layouts so the branded customer page has zero dashboard chrome leakage.

### Middleware

Used only for Supabase session cookie refresh (`@supabase/ssr` pattern) and to gate `/dashboard/*` and `/onboarding/*`. Does **not** touch `/c/*` (those routes must work anonymously).

---

## 7. Data Model

All tables in `public` schema. UUIDs via `gen_random_uuid()`.

```sql
create type video_status as enum ('new', 'saved', 'hidden');
create type video_processing_status as enum ('uploading','ready','failed');

create table owners (
  id uuid primary key references auth.users(id) on delete cascade,
  business_name text not null default '',
  accent_color text not null default '#111111',
  logo_path text,
  cta_text text,
  branding_complete boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table qr_codes (
  id text primary key,                    -- nanoid(10)
  owner_id uuid not null references owners(id) on delete cascade,
  location_label text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);
create unique index one_default_qr_per_owner
  on qr_codes(owner_id) where is_default = true and archived_at is null;
create index qr_codes_owner_idx on qr_codes(owner_id);

create table videos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners(id) on delete cascade,
  qr_code_id text not null references qr_codes(id) on delete restrict,
  storage_path text not null,
  thumbnail_path text,
  mime_type text not null,
  duration_ms integer,
  width integer,
  height integer,
  size_bytes bigint,
  consent_text_snapshot text not null,
  location_label_snapshot text,
  status video_status not null default 'new',
  processing_status video_processing_status not null default 'uploading',
  ip_hash text,
  created_at timestamptz not null default now(),
  deleted_at timestamptz                  -- soft delete; purge after 30d
);
create index videos_owner_created_idx
  on videos(owner_id, created_at desc) where deleted_at is null;
create index videos_owner_status_idx
  on videos(owner_id, status) where deleted_at is null;
create index videos_deleted_purge_idx
  on videos(deleted_at) where deleted_at is not null;
```

**RLS policies** (all three tables enabled):

```sql
-- owners: self-access only
create policy "owner self read"  on owners for select using (id = auth.uid());
create policy "owner self write" on owners for update using (id = auth.uid());

-- qr_codes: owner all, anon read (for landing lookup)
create policy "qr owner all" on qr_codes
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "qr anon read" on qr_codes
  for select to anon using (archived_at is null);

-- videos: owner read/update only; inserts via service role
create policy "videos owner read"
  on videos for select using (owner_id = auth.uid() and deleted_at is null);
create policy "videos owner update"
  on videos for update using (owner_id = auth.uid());
-- No INSERT policy → anon cannot write directly; all inserts go through
-- /api/upload/sign and /api/videos using service-role key.
```

**Owner row provisioning:** Postgres trigger on `auth.users` insert → `insert into owners(id) values (new.id)`. Avoids race on first login.

**Storage buckets:**
- `videos` (private). Path: `{owner_id}/{video_id}.{ext}`. Original files only in v1.
- `thumbnails` (private but with potential to expose if we add CDN-cached thumbs later). Path: `{owner_id}/{video_id}.jpg`.
- `logos` (private). Path: `{owner_id}/logo.{ext}`. Served to anon customer page via signed URL with long TTL.

---

## 8. Video Capture & Upload

### Camera capture

Roll our own thin wrapper around `MediaRecorder` (~150 lines) under `lib/recorder/`. Third-party libraries don't solve the iOS/Android codec divergence or orientation handling.

**Codec selection** (feature-detect in order):
```ts
const candidates = [
  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',  // iOS Safari 14.5+
  'video/webm;codecs=vp9,opus',              // Chrome/Edge/Firefox
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const mimeType = candidates.find(c => MediaRecorder.isTypeSupported(c));
```
Persist `mimeType` on the `videos` row.

**getUserMedia constraints:**
```ts
{ video: { facingMode: 'user',
           width: { ideal: 1080 }, height: { ideal: 1920 },
           aspectRatio: { ideal: 9/16 }, frameRate: { ideal: 30 } },
  audio: true }
```

**Bitrate cap (critical):**
```ts
new MediaRecorder(stream, {
  mimeType,
  videoBitsPerSecond: 2_500_000,
  audioBitsPerSecond: 96_000,
});
```
2.5 Mbps × 30s ≈ 9MB. Browser defaults can be 8–10 Mbps producing 30–40MB files. This single setting prevents an order-of-magnitude egress cost difference.

**Orientation handling:**
- CSS-lock the record UI to portrait via media queries.
- Call `screen.orientation.lock('portrait')` (works on Android, ignored on iOS).
- If `video.videoWidth > video.videoHeight` at start, show "Please hold your phone upright" overlay and disable the record button.

**iOS specifics:**
- `<video>` preview needs `playsInline` and `muted` for autoplay.
- Call `recorder.start(1000)` (timeslice) so iOS flushes chunks every second — protects against tab background losing a recording.
- Support matrix: iOS Safari 14.5+, Android Chrome current. Older versions get a "please update your browser" message.

**Hard duration limit:** belt-and-suspenders — `setTimeout(stop, 30000)` plus elapsed check in `ondataavailable`.

### Upload

**Direct-to-Storage via signed upload URLs.** Vercel function payload limits and bandwidth cost rule out proxying.

**Flow:**
1. Client → `POST /api/upload/sign` with `{ qrCodeId, mimeType, sizeBytes, durationMs }`.
   - Server validates: qr_code exists and not archived; size ≤ 50MB; duration ≤ 31000ms.
   - Server inserts `videos` row (`processing_status='uploading'`), snapshots consent text and location label.
   - Returns `{ videoId, uploadUrl, storagePath }` from `supabase.storage.from('videos').createSignedUploadUrl(path)`.
2. Client `PUT`s blob to `uploadUrl` directly using `tus-js-client` (Supabase Storage speaks TUS — gives resumable uploads, survives backgrounding).
3. Client → `POST /api/videos` with `{ videoId, width, height, thumbnailDataUrl }`.
   - Server flips `processing_status='ready'`, persists dimensions, writes thumbnail to `thumbnails` bucket.

**Thumbnail capture: client-side canvas snapshot** at end of recording. Draw frame from preview `<video>` at 0.1s to a 360×640 canvas, export JPEG, base64 it, send with finalize. No server-side ffmpeg.

**Resumability:** Stash the recorded blob in IndexedDB before upload begins. On confirmed finalize, clear it. On next page load, if a stranded blob exists, offer "Resume sending."

---

## 9. Authentication

**Library:** `@supabase/ssr` (the current package; `auth-helpers-nextjs` is deprecated). Three client factories:
- `lib/supabase/client.ts` — browser
- `lib/supabase/server.ts` — RSC/route handlers, reads cookies
- `lib/supabase/admin.ts` — service-role, server-only, used for upload sign + finalize

**Magic link flow:**
1. `/login` form → `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: 'https://kollab.app/auth/callback' }})`.
2. Email sent via Supabase Auth → SMTP configured to Resend in Supabase project settings → Auth → SMTP. Email template customized to read "Kollab" not "Supabase."
3. `/auth/callback/route.ts` reads `code` query param, calls `exchangeCodeForSession`, sets cookies, then:
```ts
const { data } = await supabase.from('owners')
  .select('branding_complete').eq('id', user.id).single();
redirect(data?.branding_complete ? '/dashboard' : '/onboarding/step-1');
```

**Middleware uses `getUser()`, not `getSession()`** — `getSession()` reads the cookie without verifying, which is unsafe for gating.

---

## 10. Email Notifications

**Library:** `resend` SDK + `@react-email/components`. One template: `NewVideosEmail({ ownerName, count, businessName, dashboardUrl })`.

**Debounce strategy:** Naive "send on insert" spams owners during dinner rush. Instead, a coalescing table:

```sql
create table pending_notifications (
  owner_id uuid primary key references owners(id) on delete cascade,
  first_video_at timestamptz not null,
  video_count integer not null default 1
);
```

**Trigger fires on transition to `ready`, not on initial insert** — videos enter as `processing_status='uploading'` and we don't want to email owners about uploads that may fail. Trigger condition: `AFTER UPDATE ON videos WHEN OLD.processing_status IS DISTINCT FROM 'ready' AND NEW.processing_status = 'ready'`. Effect: upsert into `pending_notifications` — increment count, set `first_video_at` only on new row.

A Supabase cron job (every minute) flushes rows where `now() - first_video_at > interval '2 minutes'`, sends one email per owner ("You have N new videos"), and deletes the pending row. 2 minutes is long enough to coalesce a table's submissions, short enough that owners feel timely.

**Idempotency:** Use `first_video_at` as Resend's `idempotencyKey` so cron retries can't double-send.

**Bounces:** Resend webhook → mark owner email as invalid; settings page exposes unsubscribe toggle.

---

## 11. Edge Cases

| Case | Handling |
|---|---|
| Desktop scan | Detect missing `mediaDevices` or no touch input → show "Open this on your phone" page with the same URL re-encoded as a smaller QR for easy phone scan. Don't hard-block laptops with webcams. |
| Camera permission denied | Dedicated state with browser-specific re-enable instructions + "Try again" button. |
| Mid-upload network drop | `tus-js-client` auto-resumes. Blob held in IndexedDB. On next page load with a stranded blob, offer "Resume sending." |
| Unsupported browser | Feature-detect `MediaRecorder` + `getUserMedia` + at least one supported `mimeType` at landing. If any miss: "Your browser can't record video — try Safari (iOS) or Chrome (Android)." |
| QR for non-existent / archived owner | Server-fetch qr_code joined with owner; if missing/archived, neutral "This QR is no longer active" page. Never expose owner identity in errors. |
| Owner deletes account | `on delete cascade` from `owners` removes their videos and qr_codes. Storage objects purged by a separate job (RLS cascade doesn't touch Storage). |
| 30s overshoot | Hard `setTimeout(stop, 30000)` + elapsed check in `ondataavailable` as backup. Visual countdown ring. |
| Soft-deleted videos | A daily cron purges `videos` where `deleted_at < now() - interval '30 days'` AND deletes their Storage objects. |

---

## 12. Implementation Phasing

**Phase A — Foundation (3–4 days)**
- `create-next-app`, Tailwind, shadcn/ui init.
- Supabase project; migrations for all three tables + RLS + the `auth.users` trigger.
- `@supabase/ssr` client factories + middleware.
- `/login` + `/auth/callback` working end-to-end with Resend SMTP.
- ✓ *Works when:* magic link arrives via Resend, click lands on placeholder `/dashboard` with `user.id` printed.

**Phase B — Owner onboarding + QR (3–4 days)**
- Onboarding steps 1–3 with logo upload to `logos` bucket.
- `qr_codes` row creation with default-flag enforcement.
- `GET /api/qr/[id]/pdf` returning a real print-ready PDF (`@react-pdf/renderer`).
- `branding_complete` flip + post-login routing.
- ✓ *Works when:* fresh account walks all three steps, downloads a printable PDF, lands on empty dashboard.

**Phase C — Customer capture + upload (5–7 days)**
- `/c/[qrCodeId]` branded landing.
- Recorder component with codec detection, bitrate cap, orientation check.
- Signed upload URL endpoint + TUS resumable upload + finalize endpoint.
- Client-side thumbnail capture.
- Thanks screen.
- ✓ *Works when:* on real iPhone and real Android, a 30s video uploads, a row appears in `videos` with `processing_status='ready'`, the file plays back from Storage, and the thumbnail renders.

**Phase D — Owner inbox (3–4 days)**
- Inbox grid with thumbnails (signed URLs), status badges, pagination.
- Video detail page: full-screen player, download, soft-delete, status toggle.
- ✓ *Works when:* uploaded video appears in inbox within 2s, plays, downloads as MP4/WebM, soft-deletes and recovers within 30 days.

**Phase E — Notifications + polish (2–3 days)**
- `pending_notifications` table + insert trigger + cron flush + Resend send.
- React Email template.
- 30-day purge cron for soft-deleted videos (DB row + Storage object).
- ✓ *Works when:* uploading 3 videos in a minute results in exactly one email 2 minutes later saying "You have 3 new videos."

**Total v1 estimate: 16–22 working days.**

---

## 13. Risks

1. **Bitrate defaults → egress bill.** If the 2.5 Mbps cap isn't set in Phase C, file sizes balloon 4× and Supabase egress costs explode. Server-side 50MB size check in `/api/upload/sign` as a backstop.
2. **WebM playback in desktop Safari.** Android-Chrome-recorded WebM won't play in Mac Safari. Acceptable for v1 (most owners triage on phone/Chrome). If WebM share is non-trivial in telemetry, add Cloudflare Stream transcoding behind the finalize endpoint in v2.
3. **iOS Safari MediaRecorder shallow support.** 14.5+ minimum. Explicit "please update iOS" message rather than silent failure.
4. **`screen.orientation.lock` unsupported on iOS Safari.** Don't promise vertical-only recording in marketing. UI is portrait-locked; sensor records what's held.
5. **Supabase Storage signed-URL expiry.** Inbox grid generates many signed URLs at once — generate server-side per request, not client-side.
6. **RLS / insert gotcha.** Never add an `INSERT` policy on `videos` for the `anon` role — it bypasses consent text snapshotting. All video inserts stay server-side via service role.
7. **PWA / "Add to Home Screen" loses camera permissions.** Customer flow must stay in regular Safari, not a PWA shell.
8. **Cron granularity on Supabase tier.** The 2-minute debounce assumes a 1-minute cron. Verify the chosen plan before Phase E.
9. **Vercel cold start on `/c/[qrCodeId]`.** 500ms+ cold start undermines the friction-free pitch. Use Edge runtime on that route, or static + client-fetched branding.
10. **Storage purge for soft-deleted videos.** The 30-day promise requires actual Storage deletion at day 30, not just nulling a column. Built in Phase E.
11. **GDPR-ready.** `consent_text_snapshot` + `ip_hash` + `created_at` together form a defensible record. Account-deletion/data-export endpoints not in v1 but cheap to add when asked.

---

## 14. Parking Lot (v2+)

In rough priority order, based on the value-flywheel logic:

1. **Auto-stitch / cinematic templates** — the original "wow" feature. Build once owner inbox volume justifies it.
2. **Owner-configurable perks** ("Show this for a free dessert") — strong word-of-mouth flywheel: customer shares → gets perk → tells friends → owner gets more content + repeat visits.
3. **Subscription billing** — Stripe + plan tiers. Needs to be in place before owner volume scales.
4. **Watermarked downloads** — gated to paid tier. Doubles as brand exposure on every clip shared elsewhere.
5. **Location-based filtering in inbox** — already capturing the data; just need the UI.
6. **Multi-user / team roles** — when restaurant managers ask.
7. **Push notifications** — once owners express that email isn't immediate enough.
8. **Direct social posting** — IG / TikTok / Google / Yelp APIs.
9. **Customer-side accounts** — "save my submissions to my own gallery."
10. **Transcoding pipeline** — driven by telemetry on WebM share.

---

## 15. Success Criteria

v1 ships when:
- A real restaurant owner can sign up, complete onboarding, and print a QR code in under 5 minutes.
- A real diner can scan that QR on iPhone or Android and submit a 30s video in under 60 seconds end-to-end (including upload).
- The owner sees the video in their inbox within 5 seconds of upload finalize, plays it, and downloads the MP4.
- An email notification arrives within 3 minutes of submission (debounced).
- All of the above works without anyone installing an app.
