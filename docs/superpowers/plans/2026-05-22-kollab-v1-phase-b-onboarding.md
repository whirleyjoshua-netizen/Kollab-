# Kollab v1 — Phase B: Owner Onboarding & QR Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner can sign in, complete a 3-step onboarding (business basics → logo → QR ready), download a print-ready PDF of their QR code, and have that QR code resolve to a branded customer landing stub that proves the end-to-end identity loop works.

**Architecture:** Next.js App Router server components + server actions for the onboarding form flow. Logo upload is server-proxied through a Next.js route (file is small, simpler than signed URLs at v1). QR PNG generated server-side via `qrcode` lib, PDF via `@react-pdf/renderer` — both rendered per request with HTTP cache headers (Vercel/CDN handle the rest). Customer landing at `/c/[qrCodeId]` is a server component that reads the QR + owner via the anon client (RLS allows it). Real video capture is Phase C — Phase B's `/c/*` route is a branded "we know who you are" stub.

**Tech Stack:** Next.js 16, TypeScript, Supabase (Postgres + Storage), `qrcode` (PNG), `@react-pdf/renderer` (PDF), `nanoid` (QR IDs), `zod` (input validation), shadcn/ui (forms).

**Reference spec:** `docs/superpowers/specs/2026-05-19-kollab-v1-design.md`
**Predecessor plan:** `docs/superpowers/plans/2026-05-19-kollab-v1-phase-a-foundation.md` (tagged `phase-a-complete`)

**Phase A carryovers addressed in this plan:**
- Task 1: dashboard `branding_complete` redirect
- Task 6: storage RLS policies for `logos` bucket
- Task 8: removal of "Skip to dashboard" placeholder link

---

## Task 1: Carryover — dashboard branding_complete redirect

The Phase A final review noted that `/dashboard` doesn't check `branding_complete` on direct visit. New users who bookmark `/dashboard` skip onboarding. Plug this before any Phase B onboarding work lands.

**Files:**
- Modify: `app/(owner)/dashboard/page.tsx`

- [ ] **Step 1: Add the branding_complete check**

Open `app/(owner)/dashboard/page.tsx`. Find the section after `if (!data.user) redirect('/login');` and add a query + redirect:

```tsx
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData.user) {
    redirect('/login');
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner?.branding_complete) {
    redirect('/onboarding/step-1');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{userData.user.email}</span>
      </p>
      <p className="text-xs text-muted-foreground font-mono">
        user.id = {userData.user.id}
      </p>
      <form action={signOut}>
        <Button type="submit" variant="outline">
          Sign out
        </Button>
      </form>
    </main>
  );
}
```

Note: `data` was renamed to `userData` to make room for the new `owner` query. Make sure to also update the references in the JSX (`userData.user.email`, `userData.user.id`).

- [ ] **Step 2: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/dashboard/page.tsx"
git commit -m "fix(dashboard): redirect to onboarding when branding_complete is false"
```

---

## Task 2: Install Phase B dependencies

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Install QR + PDF generation libs**

```powershell
pnpm add qrcode @react-pdf/renderer
pnpm add -D @types/qrcode
```

- [ ] **Step 2: Verify versions**

Confirm in `package.json` that `qrcode`, `@react-pdf/renderer` are in dependencies and `@types/qrcode` is in devDependencies.

- [ ] **Step 3: Commit**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: install qrcode and react-pdf for QR generation"
```

---

## Task 3: Reusable form pieces — onboarding step shell

To avoid repeating the same wrapper card across three steps, build a shared layout.

**Files:**
- Create: `components/owner/onboarding-shell.tsx`

- [ ] **Step 1: Write the shell**

Create `components/owner/onboarding-shell.tsx`:

```tsx
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type OnboardingShellProps = {
  step: 1 | 2 | 3;
  title: string;
  description?: string;
  children: React.ReactNode;
};

export function OnboardingShell({ step, title, description, children }: OnboardingShellProps) {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            Step {step} of 3
          </p>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
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
git add components/owner/onboarding-shell.tsx
git commit -m "feat(onboarding): add shared step shell"
```

---

## Task 4: Onboarding Step 1 — business basics server action

The action that persists business name, CTA, and accent color to the `owners` row.

**Files:**
- Create: `app/(owner)/onboarding/step-1/actions.ts`

- [ ] **Step 1: Write the action**

Create `app/(owner)/onboarding/step-1/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  business_name: z
    .string()
    .trim()
    .min(1, 'Business name is required.')
    .max(80, 'Business name must be 80 characters or fewer.'),
  cta_text: z
    .string()
    .trim()
    .max(120, 'Call-to-action must be 120 characters or fewer.')
    .optional()
    .or(z.literal('')),
  accent_color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Accent color must be a hex like #FF5577.'),
});

export type Step1Result =
  | { status: 'ok' }
  | { status: 'error'; message: string };

export async function saveBusinessBasics(formData: FormData): Promise<Step1Result> {
  const parsed = Schema.safeParse({
    business_name: formData.get('business_name'),
    cta_text: formData.get('cta_text'),
    accent_color: formData.get('accent_color'),
  });

  if (!parsed.success) {
    return {
      status: 'error',
      message: parsed.error.issues[0]?.message ?? 'Invalid input.',
    };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Not signed in.' };
  }

  const { error } = await supabase
    .from('owners')
    .update({
      business_name: parsed.data.business_name,
      cta_text: parsed.data.cta_text || null,
      accent_color: parsed.data.accent_color,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.user.id);

  if (error) {
    return { status: 'error', message: error.message };
  }

  redirect('/onboarding/step-2');
}
```

Notes:
- The redirect must be OUTSIDE the try/catch zone (Next.js uses an internal exception to signal redirects). Calling `redirect()` after a successful update sends the user forward; the client-side form code reads the response only if there was no redirect (i.e., on error).
- Empty `cta_text` becomes `null` in the DB (rather than empty string) for cleaner consumption later.

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/onboarding/step-1/actions.ts"
git commit -m "feat(onboarding): add server action for business basics"
```

---

## Task 5: Onboarding Step 1 — form client component

**Files:**
- Create: `app/(owner)/onboarding/step-1/step-1-form.tsx`

- [ ] **Step 1: Write the form**

Create `app/(owner)/onboarding/step-1/step-1-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { saveBusinessBasics, type Step1Result } from './actions';

type Step1FormProps = {
  defaults: {
    business_name: string;
    cta_text: string | null;
    accent_color: string;
  };
};

export function Step1Form({ defaults }: Step1FormProps) {
  const [result, setResult] = useState<Step1Result | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await saveBusinessBasics(formData);
          // Server action calls redirect() on success — we only see a value here on error.
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="business_name">Business name</Label>
        <Input
          id="business_name"
          name="business_name"
          required
          maxLength={80}
          defaultValue={defaults.business_name}
          placeholder="Bella's Italian"
          disabled={isPending}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="cta_text">Call to action (optional)</Label>
        <Input
          id="cta_text"
          name="cta_text"
          maxLength={120}
          defaultValue={defaults.cta_text ?? ''}
          placeholder="Share up to 30 seconds of your experience at Bella's"
          disabled={isPending}
        />
        <p className="text-xs text-muted-foreground">
          Shown above the recording button on your customer landing page.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="accent_color">Accent color</Label>
        <div className="flex items-center gap-3">
          <Input
            id="accent_color"
            name="accent_color"
            type="color"
            required
            defaultValue={defaults.accent_color}
            disabled={isPending}
            className="h-10 w-16 cursor-pointer p-1"
          />
          <p className="text-xs text-muted-foreground">
            Used for the primary button on your customer page.
          </p>
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Continue'}
      </Button>

      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/onboarding/step-1/step-1-form.tsx"
git commit -m "feat(onboarding): add step 1 client form"
```

---

## Task 6: Onboarding Step 1 — page (replace placeholder)

**Files:**
- Modify: `app/(owner)/onboarding/step-1/page.tsx`

- [ ] **Step 1: Replace the placeholder**

Overwrite `app/(owner)/onboarding/step-1/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { Step1Form } from './step-1-form';

export default async function OnboardingStep1Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, cta_text, accent_color, branding_complete')
    .eq('id', userData.user.id)
    .single();

  // If onboarding already complete, send to dashboard.
  if (owner?.branding_complete) redirect('/dashboard');

  return (
    <OnboardingShell
      step={1}
      title="Tell us about your business"
      description="Customers see this on the page they land on after scanning your QR code."
    >
      <Step1Form
        defaults={{
          business_name: owner?.business_name ?? '',
          cta_text: owner?.cta_text ?? null,
          accent_color: owner?.accent_color ?? '#111111',
        }}
      />
    </OnboardingShell>
  );
}
```

This page is a Server Component — it reads the current owner row to pre-fill the form (so if the user navigates back from Step 2, their inputs are preserved). The placeholder "Skip to dashboard" link is removed by this overwrite.

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Smoke test (manual)**

```powershell
pnpm dev
```

Sign in via magic link (using `culturalarchitectscollective@gmail.com` per the Phase A smoke). You should land on `/onboarding/step-1`, see the form pre-filled with your defaults (likely empty business name, default accent color `#111111`), enter values, and be redirected to `/onboarding/step-2`. That route doesn't exist yet — expect a 404. That's OK; we build it next.

- [ ] **Step 4: Commit**

```powershell
git add "app/(owner)/onboarding/step-1/page.tsx"
git commit -m "feat(onboarding): wire real step 1 page"
```

---

## Task 7: Storage RLS — logos bucket

Carryover from Phase A. Authenticated owners get read/write to `logos/{user.id}/*` only.

**Files:**
- Create: `supabase/migrations/<timestamp>_logos_storage_rls.sql`

- [ ] **Step 1: Create migration file**

```powershell
pnpm exec supabase migration new logos_storage_rls
```

- [ ] **Step 2: Write contents**

```sql
-- Storage RLS for the `logos` bucket.
-- Each owner can read/write only files under their own user-id-prefixed folder.

-- Allow authenticated owners to upload their logo under logos/{auth.uid()}/...
create policy "owners can write own logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated owners to overwrite their own logo.
create policy "owners can update own logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow owners to read their own logo (e.g., dashboard preview).
create policy "owners can read own logo"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow owners to delete their own logo.
create policy "owners can delete own logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Anonymous customers reading via signed URLs do NOT need a policy
-- (signed URLs bypass RLS).
```

- [ ] **Step 3: Apply migration**

```powershell
pnpm exec supabase db push
```

Answer `yes` if prompted.

- [ ] **Step 4: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(storage): add RLS policies for logos bucket"
```

---

## Task 8: Onboarding Step 2 — logo upload server action

Server-proxied upload: file comes in via FormData, server validates size + MIME, uploads via admin client to `logos/{user.id}/logo.{ext}`, persists `logo_path` on owners row.

**Files:**
- Create: `app/(owner)/onboarding/step-2/actions.ts`

- [ ] **Step 1: Write the action**

Create `app/(owner)/onboarding/step-2/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

export type Step2Result =
  | { status: 'ok' }
  | { status: 'error'; message: string };

export async function uploadLogo(formData: FormData): Promise<Step2Result> {
  const file = formData.get('logo');

  if (!(file instanceof File) || file.size === 0) {
    return { status: 'error', message: 'Please choose a logo image.' };
  }
  if (file.size > MAX_BYTES) {
    return { status: 'error', message: 'Logo must be 2 MB or smaller.' };
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return { status: 'error', message: 'Logo must be a PNG, JPEG, or WebP image.' };
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return { status: 'error', message: 'Not signed in.' };
  }

  const ext = file.type === 'image/png'
    ? 'png'
    : file.type === 'image/webp'
      ? 'webp'
      : 'jpg';
  const path = `${userData.user.id}/logo.${ext}`;

  const admin = createAdminClient();

  // Upload (upsert so replacing the logo works).
  const { error: uploadError } = await admin.storage
    .from('logos')
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) {
    return { status: 'error', message: uploadError.message };
  }

  // Persist the path on the owners row.
  const { error: updateError } = await admin
    .from('owners')
    .update({
      logo_path: path,
      updated_at: new Date().toISOString(),
    })
    .eq('id', userData.user.id);

  if (updateError) {
    return { status: 'error', message: updateError.message };
  }

  redirect('/onboarding/step-3');
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/onboarding/step-2/actions.ts"
git commit -m "feat(onboarding): add server action for logo upload"
```

---

## Task 9: Onboarding Step 2 — form client component

Includes a live preview before submit so the owner knows what they picked.

**Files:**
- Create: `app/(owner)/onboarding/step-2/step-2-form.tsx`

- [ ] **Step 1: Write the form**

Create `app/(owner)/onboarding/step-2/step-2-form.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { uploadLogo, type Step2Result } from './actions';

type Step2FormProps = {
  existingLogoUrl: string | null;
};

export function Step2Form({ existingLogoUrl }: Step2FormProps) {
  const [result, setResult] = useState<Step2Result | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(existingLogoUrl);
  const [hasNewFile, setHasNewFile] = useState(false);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Clean up any object URL we created.
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setHasNewFile(false);
      setPreviewUrl(existingLogoUrl);
      return;
    }
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
    setHasNewFile(true);
    setResult(null);
  }

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await uploadLogo(formData);
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="logo">Logo image</Label>
        <Input
          ref={fileInputRef}
          id="logo"
          name="logo"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          required={!existingLogoUrl}
          disabled={isPending}
          onChange={handleFileChange}
        />
        <p className="text-xs text-muted-foreground">
          PNG, JPEG, or WebP. Up to 2 MB. Square images work best.
        </p>
      </div>

      {previewUrl && (
        <div className="flex flex-col items-center gap-2">
          <div className="h-32 w-32 overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Logo preview"
              className="h-full w-full object-cover"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {hasNewFile ? 'New logo preview' : 'Current logo'}
          </p>
        </div>
      )}

      <Button type="submit" disabled={isPending || (!hasNewFile && !existingLogoUrl)}>
        {isPending ? 'Uploading…' : 'Continue'}
      </Button>

      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/onboarding/step-2/step-2-form.tsx"
git commit -m "feat(onboarding): add step 2 logo form with live preview"
```

---

## Task 10: Onboarding Step 2 — page

**Files:**
- Create: `app/(owner)/onboarding/step-2/page.tsx`

- [ ] **Step 1: Write the page**

Create `app/(owner)/onboarding/step-2/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { Step2Form } from './step-2-form';

export default async function OnboardingStep2Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, logo_path, branding_complete')
    .eq('id', userData.user.id)
    .single();

  // If Step 1 wasn't done, redirect back.
  if (!owner || !owner.business_name) redirect('/onboarding/step-1');
  if (owner.branding_complete) redirect('/dashboard');

  // Generate a short-lived signed URL for any existing logo (to show in preview).
  let existingLogoUrl: string | null = null;
  if (owner.logo_path) {
    const admin = createAdminClient();
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60); // 1 hour
    existingLogoUrl = signed?.signedUrl ?? null;
  }

  return (
    <OnboardingShell
      step={2}
      title="Upload your logo"
      description="This shows on the page customers see after scanning your QR code."
    >
      <Step2Form existingLogoUrl={existingLogoUrl} />
    </OnboardingShell>
  );
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Smoke test (manual)**

Refresh `pnpm dev` if needed. Walk through Step 1 → Step 2 → upload a logo → confirm the preview appears → submit → expect redirect to `/onboarding/step-3` (which doesn't exist yet — 404 is expected).

- [ ] **Step 4: Commit**

```powershell
git add "app/(owner)/onboarding/step-2/page.tsx"
git commit -m "feat(onboarding): wire step 2 page with logo preview"
```

---

## Task 11: QR generation helper

Centralize QR ID generation + URL building so Step 3 and any future code use one source of truth.

**Files:**
- Create: `lib/qr.ts`

- [ ] **Step 1: Write the helper**

Create `lib/qr.ts`:

```ts
import { customAlphabet } from 'nanoid';

// URL-safe alphabet (no ambiguous chars like 0/O, 1/l/I).
// 10 chars from a 58-symbol alphabet ≈ 58 bits of entropy.
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const generateId = customAlphabet(ALPHABET, 10);

export function generateQrCodeId(): string {
  return generateId();
}

export function getQrCodeUrl(qrCodeId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  return `${base}/c/${qrCodeId}`;
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/qr.ts
git commit -m "feat(qr): add QR ID generator and URL builder"
```

---

## Task 12: Onboarding Step 3 — finalize server action

Creates the default QR code row, flips `branding_complete`, redirects to dashboard.

**Files:**
- Create: `app/(owner)/onboarding/step-3/actions.ts`

- [ ] **Step 1: Write the action**

Create `app/(owner)/onboarding/step-3/actions.ts`:

```ts
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
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/onboarding/step-3/actions.ts"
git commit -m "feat(onboarding): add finalize action with default QR creation"
```

---

## Task 13: QR PNG generation API route

Server route that returns a PNG image of the QR code for a given ID. Caches at the CDN.

**Files:**
- Create: `app/api/qr/[id]/png/route.ts`

- [ ] **Step 1: Write the route**

Create `app/api/qr/[id]/png/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { toBuffer } from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQrCodeUrl } from '@/lib/qr';

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;

  // Verify the QR exists and is not archived.
  const admin = createAdminClient();
  const { data: qr, error } = await admin
    .from('qr_codes')
    .select('id, archived_at')
    .eq('id', id)
    .maybeSingle();

  if (error || !qr || qr.archived_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = getQrCodeUrl(id);
  const png = await toBuffer(url, {
    errorCorrectionLevel: 'H', // High — recoverable with up to 30% damage / logo overlay later.
    margin: 2,
    scale: 12, // ~360px at default size. Plenty for print at 300 DPI inset into PDF.
  });

  return new NextResponse(new Uint8Array(png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      // Cache aggressively — QR content never changes for a given ID.
      'Cache-Control': 'public, max-age=86400, s-maxage=604800, immutable',
    },
  });
}
```

- [ ] **Step 2: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Manual smoke (deferred until Step 3 page exists)**

We'll visually verify in Task 16. For now, compile is enough.

- [ ] **Step 4: Commit**

```powershell
git add app/api/qr
git commit -m "feat(qr): add PNG generation route"
```

---

## Task 14: QR PDF generation API route

Print-ready PDF: business name, QR, simple "Scan to share a quick video" copy. Letter and A4 via `?size=letter|a4`.

**Files:**
- Create: `app/api/qr/[id]/pdf/route.tsx` *(`.tsx` — the route contains JSX for the PDF component)*
- Create: `components/owner/qr-card-pdf.tsx`

- [ ] **Step 1: Write the PDF component**

Create `components/owner/qr-card-pdf.tsx`:

```tsx
import { Document, Image, Page, StyleSheet, Text, View } from '@react-pdf/renderer';

type QrCardPdfProps = {
  businessName: string;
  qrPngDataUrl: string; // data:image/png;base64,...
  size: 'letter' | 'a4';
};

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
    backgroundColor: '#ffffff',
  },
  inner: {
    alignItems: 'center',
    gap: 24,
  },
  brand: {
    fontSize: 36,
    fontWeight: 700,
  },
  prompt: {
    fontSize: 18,
    color: '#444',
    textAlign: 'center',
    maxWidth: 420,
  },
  qr: {
    width: 360,
    height: 360,
  },
  footer: {
    marginTop: 24,
    fontSize: 10,
    color: '#888',
  },
});

export function QrCardPdf({ businessName, qrPngDataUrl, size }: QrCardPdfProps) {
  return (
    <Document>
      <Page size={size === 'a4' ? 'A4' : 'LETTER'} style={styles.page}>
        <View style={styles.inner}>
          <Text style={styles.brand}>{businessName}</Text>
          <Text style={styles.prompt}>
            Scan to share a quick video of your experience
          </Text>
          <Image src={qrPngDataUrl} style={styles.qr} />
          <Text style={styles.footer}>Powered by Kollab</Text>
        </View>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 2: Write the route**

Create `app/api/qr/[id]/pdf/route.tsx` (note the `.tsx` extension — the file contains JSX):

```tsx
import { NextResponse, type NextRequest } from 'next/server';
import { renderToBuffer } from '@react-pdf/renderer';
import { toDataURL } from 'qrcode';
import { createAdminClient } from '@/lib/supabase/admin';
import { getQrCodeUrl } from '@/lib/qr';
import { QrCardPdf } from '@/components/owner/qr-card-pdf';

// @react-pdf/renderer requires Node.js runtime (uses Buffer, streams).
export const runtime = 'nodejs';

type Params = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const size = searchParams.get('size') === 'a4' ? 'a4' : 'letter';

  const admin = createAdminClient();

  // Look up QR + owner for the business name on the printout.
  const { data: qr } = await admin
    .from('qr_codes')
    .select('id, archived_at, owner_id')
    .eq('id', id)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    return new NextResponse('Not found', { status: 404 });
  }

  const { data: owner } = await admin
    .from('owners')
    .select('business_name')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner) {
    return new NextResponse('Not found', { status: 404 });
  }

  const url = getQrCodeUrl(id);
  const qrPngDataUrl = await toDataURL(url, {
    errorCorrectionLevel: 'H',
    margin: 2,
    scale: 12,
  });

  const pdfBuffer = await renderToBuffer(
    <QrCardPdf
      businessName={owner.business_name || 'Kollab'}
      qrPngDataUrl={qrPngDataUrl}
      size={size}
    />
  );

  const filename = `kollab-qr-${(owner.business_name || 'qr').replace(/[^a-z0-9-]+/gi, '-').toLowerCase()}.pdf`;

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'public, max-age=3600, s-maxage=86400',
    },
  });
}
```

- [ ] **Step 3: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add app/api/qr "components/owner/qr-card-pdf.tsx"
git commit -m "feat(qr): add print-ready PDF generation route"
```

---

## Task 15: Onboarding Step 3 — page UI

Show QR preview (PNG from Task 13), download buttons (Letter + A4 PDFs), and a "Continue to dashboard" button that calls the finalize action.

**Files:**
- Create: `app/(owner)/onboarding/step-3/page.tsx`
- Create: `app/(owner)/onboarding/step-3/finalize-button.tsx`

- [ ] **Step 1: Write the finalize button (client)**

Create `app/(owner)/onboarding/step-3/finalize-button.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { finalizeOnboarding, type FinalizeResult } from './actions';

export function FinalizeButton() {
  const [result, setResult] = useState<FinalizeResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <>
      <Button
        onClick={() =>
          startTransition(async () => {
            const r = await finalizeOnboarding();
            setResult(r);
          })
        }
        disabled={isPending}
      >
        {isPending ? 'Finishing…' : 'Go to dashboard'}
      </Button>
      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </>
  );
}
```

- [ ] **Step 2: Write the page**

Create `app/(owner)/onboarding/step-3/page.tsx`:

```tsx
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { OnboardingShell } from '@/components/owner/onboarding-shell';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateQrCodeId, getQrCodeUrl } from '@/lib/qr';
import { FinalizeButton } from './finalize-button';

export default async function OnboardingStep3Page() {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/login');

  const { data: owner } = await supabase
    .from('owners')
    .select('business_name, logo_path, branding_complete')
    .eq('id', userData.user.id)
    .single();

  if (!owner || !owner.business_name) redirect('/onboarding/step-1');
  if (!owner.logo_path) redirect('/onboarding/step-2');
  if (owner.branding_complete) redirect('/dashboard');

  // Ensure a default QR exists so the preview/download have an ID to point at.
  // We use service-role to be RLS-agnostic (the owner's RLS allows this anyway).
  const admin = createAdminClient();
  let { data: defaultQr } = await admin
    .from('qr_codes')
    .select('id')
    .eq('owner_id', userData.user.id)
    .eq('is_default', true)
    .is('archived_at', null)
    .maybeSingle();

  if (!defaultQr) {
    // Insert one now so the user sees a real QR preview. The finalize action
    // is idempotent and won't double-create.
    for (let attempt = 0; attempt < 3 && !defaultQr; attempt++) {
      const newId = generateQrCodeId();
      const { data: inserted, error } = await admin
        .from('qr_codes')
        .insert({
          id: newId,
          owner_id: userData.user.id,
          is_default: true,
        })
        .select('id')
        .single();
      if (!error && inserted) {
        defaultQr = inserted;
      } else if (error && error.code !== '23505') {
        throw new Error(`Failed to create QR: ${error.message}`);
      }
    }
  }

  if (!defaultQr) {
    throw new Error('Could not provision a QR code after retries.');
  }

  const customerUrl = getQrCodeUrl(defaultQr.id);
  const pngUrl = `/api/qr/${defaultQr.id}/png`;
  const pdfLetter = `/api/qr/${defaultQr.id}/pdf?size=letter`;
  const pdfA4 = `/api/qr/${defaultQr.id}/pdf?size=a4`;

  return (
    <OnboardingShell
      step={3}
      title="Your QR code is ready"
      description="Print it and put it on your tables, windows, receipts — wherever customers can see it."
    >
      <div className="flex flex-col items-center gap-4">
        <div className="rounded-md border bg-white p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={pngUrl} alt="Your Kollab QR code" width={240} height={240} />
        </div>

        <p className="text-center text-xs text-muted-foreground break-all">
          Scans to{' '}
          <code className="font-mono">{customerUrl}</code>
        </p>

        <div className="flex w-full flex-col gap-2 pt-2">
          <Button asChild variant="outline">
            <a href={pdfLetter} download>
              Download print-ready PDF (Letter)
            </a>
          </Button>
          <Button asChild variant="outline">
            <a href={pdfA4} download>
              Download print-ready PDF (A4)
            </a>
          </Button>
          <Link
            href={customerUrl}
            target="_blank"
            className="text-center text-sm underline text-muted-foreground"
          >
            Preview the customer experience →
          </Link>
        </div>

        <div className="w-full border-t pt-4">
          <FinalizeButton />
        </div>
      </div>
    </OnboardingShell>
  );
}
```

- [ ] **Step 3: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add "app/(owner)/onboarding/step-3"
git commit -m "feat(onboarding): wire step 3 page with QR preview and PDF downloads"
```

---

## Task 16: Customer landing stub at `/c/[qrCodeId]`

Server component that fetches the QR + owner via anon client (RLS allows it), shows a branded "Scan accepted" page. No camera, no recording — Phase C builds that. This stub is what proves the QR codes resolve correctly end-to-end.

**Files:**
- Create: `app/(customer)/c/[qrCodeId]/page.tsx`
- Create: `lib/supabase/anon.ts` (for the anon read path — clean separation from server.ts which mixes in session cookies)

- [ ] **Step 1: Write an anonymous read-only client**

Create `lib/supabase/anon.ts`:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

/**
 * Anonymous read-only client. No cookies, no session.
 * Used for the customer landing route which must work without any auth.
 */
export function createAnonClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );
}
```

- [ ] **Step 2: Write the customer landing stub**

Create `app/(customer)/c/[qrCodeId]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { createAnonClient } from '@/lib/supabase/anon';
import { createAdminClient } from '@/lib/supabase/admin';

type Params = { params: Promise<{ qrCodeId: string }> };

export default async function CustomerLanding({ params }: Params) {
  const { qrCodeId } = await params;

  // Use anon client — proves the public-read RLS policy on qr_codes works
  // (anon must be able to look up a QR by id to render this page).
  const anon = createAnonClient();
  const { data: qr } = await anon
    .from('qr_codes')
    .select('id, owner_id, location_label, archived_at')
    .eq('id', qrCodeId)
    .maybeSingle();

  if (!qr || qr.archived_at) {
    notFound();
  }

  // For the owner's branding (logo, business name, accent color, CTA), we need
  // service-role because owners.* is owner-readable only by RLS.
  // Phase C will refactor this into a dedicated read path.
  const admin = createAdminClient();
  const { data: owner } = await admin
    .from('owners')
    .select('business_name, accent_color, cta_text, logo_path')
    .eq('id', qr.owner_id)
    .maybeSingle();

  if (!owner) {
    notFound();
  }

  let logoUrl: string | null = null;
  if (owner.logo_path) {
    const { data: signed } = await admin.storage
      .from('logos')
      .createSignedUrl(owner.logo_path, 60 * 60 * 6); // 6 hours
    logoUrl = signed?.signedUrl ?? null;
  }

  return (
    <main
      className="flex min-h-screen flex-col items-center justify-center gap-6 p-6 text-center"
      style={{ backgroundColor: '#fafafa' }}
    >
      {logoUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logoUrl}
          alt={`${owner.business_name} logo`}
          className="h-24 w-24 rounded-md object-cover"
        />
      )}
      <h1 className="text-3xl font-bold">{owner.business_name}</h1>
      {qr.location_label && (
        <p className="text-sm text-muted-foreground">{qr.location_label}</p>
      )}
      <p className="max-w-sm text-base text-muted-foreground">
        {owner.cta_text || 'Share a quick video of your experience.'}
      </p>
      <button
        type="button"
        disabled
        className="rounded-md px-8 py-3 font-medium text-white"
        style={{ backgroundColor: owner.accent_color }}
      >
        Start recording (coming soon)
      </button>
      <p className="text-xs text-muted-foreground">
        Recording is launching in the next update.
      </p>
    </main>
  );
}
```

Notes:
- The accent color is applied inline. Tailwind can't generate dynamic class names at runtime, so we use the style attribute.
- The `notFound()` call renders Next.js's default 404. We can build a custom branded 404 later if needed.
- Phase C will replace the disabled "Start recording" button with the real flow.

- [ ] **Step 3: Compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add "lib/supabase/anon.ts" "app/(customer)/c"
git commit -m "feat(customer): add branded landing stub at /c/[qrCodeId]"
```

---

## Task 17: End-to-end Phase B smoke test

Manual verification of the full onboarding loop and QR resolution.

**Files:** *(no code; manual)*

- [ ] **Step 1: Start dev server**

```powershell
pnpm dev
```

- [ ] **Step 2: Reset the test account (one-time)**

To re-run onboarding from scratch with a clean state for your existing test owner, run this SQL in the Supabase dashboard SQL editor:

```sql
update owners
set business_name = '',
    accent_color = '#111111',
    logo_path = null,
    cta_text = null,
    branding_complete = false
where id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com');

delete from qr_codes
where owner_id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com');
```

(Skip this step if you'd rather walk through with a fresh email — but per Phase A, only the email matching your Resend account can receive magic links until you verify a domain.)

- [ ] **Step 3: Walk the happy path**

1. Visit http://localhost:3000 → Sign in.
2. Magic link → land on `/onboarding/step-1`.
3. Fill in business name (e.g., "Bella's Italian"), CTA (e.g., "Share up to 30 seconds at Bella's"), accent color (pick a brand-y color) → Continue.
4. Land on `/onboarding/step-2`. Upload a square-ish logo (any image you like, ≤ 2 MB, PNG/JPEG/WebP). Preview should render. Continue.
5. Land on `/onboarding/step-3`. Expect:
   - QR code image rendered (a real scannable QR)
   - Two PDF download buttons (Letter, A4)
   - "Preview the customer experience →" link
6. Click both PDF download buttons. Both files should download as `kollab-qr-bellas-italian.pdf`. Open each — confirm business name, QR, and "Scan to share a quick video" copy are present.
7. Click "Preview the customer experience" → opens a new tab at `/c/{qrCodeId}` showing your logo, business name, CTA, and an accent-colored (disabled) "Start recording (coming soon)" button.
8. Back at Step 3, click "Go to dashboard" → expect redirect to `/dashboard` showing your placeholder dashboard.
9. Sign out and sign back in → expect to land directly at `/dashboard` (because `branding_complete = true` now).
10. Visit `/onboarding/step-1` while signed in → expect redirect to `/dashboard` (because `branding_complete = true`).

- [ ] **Step 4: Verify the database state**

In Supabase dashboard SQL editor:

```sql
select id, business_name, accent_color, cta_text, logo_path, branding_complete
from owners
where id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com');

select id, owner_id, is_default, location_label, archived_at
from qr_codes
where owner_id = (select id from auth.users where email = 'culturalarchitectscollective@gmail.com');
```

Expect: one `owners` row with `branding_complete = true` and all branding fields populated; one `qr_codes` row with `is_default = true` and `archived_at IS NULL`.

- [ ] **Step 5: Test the QR for real**

Open the QR PNG file or the printed PDF. Scan with your phone camera. It should open `https://your-url/c/{qrCodeId}` on your phone showing the branded landing.

(If you're running on `localhost`, your phone can't reach it unless on the same network with port forwarding. To test from a phone, use `pnpm dev --hostname 0.0.0.0` and scan with the phone connected to the same wifi, pointing at your machine's LAN IP. Or skip the phone-scan part — visual inspection of the QR image is sufficient.)

- [ ] **Step 6: Tag the phase**

```powershell
git tag -a phase-b-complete -m "Phase B: onboarding, QR generation, and customer landing stub complete"
```

---

## Phase B — Done

You now have:

- A full 3-step onboarding flow that captures business name + CTA + accent color + logo, generates a default QR code, and flips `branding_complete`
- Print-ready PDF downloads (Letter + A4) embedding the QR + branding
- A working customer landing stub at `/c/[qrCodeId]` that renders the owner's branding for any visitor who scans the QR
- The dashboard correctly redirects partially-onboarded users back to onboarding
- All Phase A carryovers addressed
- 17 commits between the Phase B starting commit and `phase-b-complete`

**Next:** Phase C — customer-side video capture (camera permissions, MediaRecorder, 30s vertical recording, preview, send-to-owner upload). To be planned with a separate `writing-plans` invocation when ready to execute.
