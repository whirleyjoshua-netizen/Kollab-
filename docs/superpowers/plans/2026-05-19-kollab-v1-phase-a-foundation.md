# Kollab v1 — Phase A: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a Next.js + Supabase project with magic-link auth working end-to-end via Resend SMTP, the full v1 database schema deployed with RLS, and a placeholder dashboard route gated by authentication.

**Architecture:** Next.js 14 App Router monorepo with TypeScript and Tailwind. Supabase provides Postgres + Auth + Storage. `@supabase/ssr` package for SSR-safe session handling with three client factories (browser, server, admin). Postgres migrations checked into the repo and applied via the Supabase CLI. Resend wired in as Supabase Auth's SMTP provider so magic-link emails carry the Kollab brand.

**Tech Stack:** Next.js 14, TypeScript, Tailwind, shadcn/ui, Supabase (Postgres + Auth + Storage), Supabase CLI, `@supabase/ssr`, Resend, `nanoid`.

**Reference spec:** `docs/superpowers/specs/2026-05-19-kollab-v1-design.md`

---

## Prerequisites (one-time manual setup)

Before executing tasks, the following accounts and CLI tools must exist. Each is a 5–10 minute manual step.

- [ ] **P1: Install Node.js 20+ and pnpm**

Verify:
```powershell
node --version    # expect v20.x or higher
pnpm --version    # expect 9.x or higher
```
If pnpm is missing:
```powershell
npm install -g pnpm
```

- [ ] **P2: Install the Supabase CLI**

```powershell
npm install -g supabase
supabase --version    # expect 1.x
```

- [ ] **P3: Create a Supabase project**

Visit https://supabase.com → New Project → name it `kollab-prod` (region nearest the user base). Wait ~2 min for provisioning.

After creation, copy these values into a scratchpad — they go into `.env.local` later:
- Project URL (Settings → API → Project URL)
- `anon` public key (Settings → API → Project API keys → anon)
- `service_role` secret key (Settings → API → Project API keys → service_role) — **keep private**
- Project Ref (Settings → General → Reference ID, the 20-char string)
- Database password (set during project creation)

- [ ] **P4: Create a Resend account and verified sending domain**

Visit https://resend.com → sign up → Domains → add `kollab.app` (or a dev domain). Follow DNS verification (SPF, DKIM). For initial local development, you can also use the Resend sandbox domain.

Get an API key (API Keys → Create) and save it.

- [ ] **P5: Connect Resend as Supabase Auth's SMTP provider**

In the Supabase dashboard for the project:
1. Authentication → Providers → Email → enable.
2. Authentication → Email Templates → Magic Link → customize:
   - Subject: `Sign in to Kollab`
   - Body: replace "Supabase" with "Kollab" everywhere.
3. Authentication → SMTP Settings → enable custom SMTP:
   - Host: `smtp.resend.com`
   - Port: `465`
   - User: `resend`
   - Password: your Resend API key
   - Sender email: `noreply@kollab.app` (must match your verified Resend domain)
   - Sender name: `Kollab`
4. Save.

- [ ] **P6: Verify prerequisites complete**

Confirm you have, written down:
- Supabase project URL, anon key, service_role key, project ref, db password
- Resend API key
- A verified sending domain in Resend
- Supabase Auth → SMTP showing Resend configured

Once all of P1–P6 are done, proceed to the tasks below.

---

## Task 1: Initialize Next.js project

**Files:**
- Create: `C:\Users\whirl\kollab_ai\package.json`
- Create: `C:\Users\whirl\kollab_ai\tsconfig.json`
- Create: `C:\Users\whirl\kollab_ai\next.config.mjs`
- Create: `C:\Users\whirl\kollab_ai\tailwind.config.ts`
- Create: `C:\Users\whirl\kollab_ai\app/layout.tsx`
- Create: `C:\Users\whirl\kollab_ai\app/page.tsx`

- [ ] **Step 1: Run create-next-app**

```powershell
pnpm create next-app@latest . --typescript --tailwind --eslint --app --src-dir false --import-alias "@/*" --use-pnpm
```

Answer prompts:
- "Would you like to use Turbopack?" → **No** (stability over speed for now)
- "Customize default import alias?" → already set via `--import-alias`

The current empty directory will be populated.

- [ ] **Step 2: Verify dev server boots**

```powershell
pnpm dev
```

Expected: server starts on http://localhost:3000, shows the Next.js welcome page. Stop with Ctrl+C.

- [ ] **Step 3: Initialize git**

```powershell
git init
git branch -M main
```

- [ ] **Step 4: Commit scaffold**

```powershell
git add -A
git commit -m "chore: initialize next.js app with typescript and tailwind"
```

---

## Task 2: Install runtime dependencies

**Files:**
- Modify: `C:\Users\whirl\kollab_ai\package.json` (via pnpm add)

- [ ] **Step 1: Add Supabase and auth packages**

```powershell
pnpm add @supabase/ssr @supabase/supabase-js
```

- [ ] **Step 2: Add utility libraries**

```powershell
pnpm add nanoid zod
```

- [ ] **Step 3: Add Resend (used in later phases but bundled in dev deps now)**

```powershell
pnpm add resend
```

- [ ] **Step 4: Add Supabase CLI as dev dep for type generation**

```powershell
pnpm add -D supabase
```

- [ ] **Step 5: Commit**

```powershell
git add package.json pnpm-lock.yaml
git commit -m "chore: install supabase, zod, nanoid, resend"
```

---

## Task 3: Initialize shadcn/ui

**Files:**
- Create: `C:\Users\whirl\kollab_ai\components.json`
- Create: `C:\Users\whirl\kollab_ai\lib/utils.ts`
- Modify: `C:\Users\whirl\kollab_ai\tailwind.config.ts`
- Modify: `C:\Users\whirl\kollab_ai\app/globals.css`

- [ ] **Step 1: Run shadcn init**

```powershell
pnpm dlx shadcn@latest init
```

Answer prompts:
- Style: `Default`
- Base color: `Slate`
- CSS variables: `Yes`

- [ ] **Step 2: Add baseline components we'll need across the dashboard**

```powershell
pnpm dlx shadcn@latest add button input label card
```

- [ ] **Step 3: Verify install**

Confirm these files now exist:
- `components/ui/button.tsx`
- `components/ui/input.tsx`
- `components/ui/label.tsx`
- `components/ui/card.tsx`
- `lib/utils.ts`

- [ ] **Step 4: Commit**

```powershell
git add -A
git commit -m "chore: init shadcn/ui with button, input, label, card"
```

---

## Task 4: Configure environment variables

**Files:**
- Create: `C:\Users\whirl\kollab_ai\.env.local`
- Create: `C:\Users\whirl\kollab_ai\.env.example`
- Modify: `C:\Users\whirl\kollab_ai\.gitignore`

- [ ] **Step 1: Write `.env.example` (committed; documents required vars)**

Create `.env.example` with this content:

```dotenv
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Resend (used by app code, separate from Supabase Auth SMTP config)
RESEND_API_KEY=re_your_resend_key

# Public app URL (used for magic link emailRedirectTo)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

- [ ] **Step 2: Copy to `.env.local` and fill with real values**

```powershell
copy .env.example .env.local
```

Then edit `.env.local` (do NOT commit) and replace each placeholder with the real values from prerequisites P3 and P4.

- [ ] **Step 3: Confirm `.env.local` is gitignored**

Open `.gitignore` and verify the line `.env*.local` is present (Next.js's default scaffold includes it). If not, add it.

- [ ] **Step 4: Commit**

```powershell
git add .env.example .gitignore
git commit -m "chore: add env.example documenting required env vars"
```

---

## Task 5: Link the local repo to the Supabase project

**Files:**
- Create: `C:\Users\whirl\kollab_ai\supabase/config.toml` (auto-generated)
- Modify: `C:\Users\whirl\kollab_ai\.gitignore`

- [ ] **Step 1: Initialize Supabase in the repo**

```powershell
pnpm supabase init
```

This creates a `supabase/` directory with `config.toml`.

- [ ] **Step 2: Link to the remote project**

```powershell
pnpm supabase link --project-ref YOUR_PROJECT_REF
```

Replace `YOUR_PROJECT_REF` with the value from prerequisite P3. You'll be prompted for the database password.

- [ ] **Step 3: Gitignore the local supabase temp dir**

Append to `.gitignore`:

```gitignore

# Supabase
supabase/.temp/
```

- [ ] **Step 4: Commit**

```powershell
git add supabase .gitignore
git commit -m "chore: link supabase project"
```

---

## Task 6: Database migration — enums and `owners` table

**Files:**
- Create: `C:\Users\whirl\kollab_ai\supabase/migrations/0001_init_schema.sql`

- [ ] **Step 1: Create the migration file**

```powershell
pnpm supabase migration new init_schema
```

This creates a timestamped file under `supabase/migrations/`. Rename it (or just use it as-is) — use `0001_init_schema.sql` for clarity. Confirm the file path matches `Files` above.

- [ ] **Step 2: Write the enums and `owners` table to the migration**

Paste the following into `supabase/migrations/0001_init_schema.sql`:

```sql
-- Kollab v1 initial schema: enums + owners table

create type video_status as enum ('new', 'saved', 'hidden');
create type video_processing_status as enum ('uploading', 'ready', 'failed');

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

-- Trigger function: auto-create owners row on auth.users insert.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.owners (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS on owners
alter table owners enable row level security;

create policy "owner self read"
  on owners for select
  using (id = auth.uid());

create policy "owner self update"
  on owners for update
  using (id = auth.uid())
  with check (id = auth.uid());
```

- [ ] **Step 3: Apply migration to the remote database**

```powershell
pnpm supabase db push
```

Expected output: `Applied migration 0001_init_schema.sql`.

- [ ] **Step 4: Verify the table exists**

Open the Supabase dashboard → Table Editor. Confirm `owners` table is present with expected columns.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(db): create owners table with auth trigger and RLS"
```

---

## Task 7: Database migration — `qr_codes` table

**Files:**
- Create: `C:\Users\whirl\kollab_ai\supabase/migrations/0002_qr_codes.sql`

- [ ] **Step 1: Create the migration file**

```powershell
pnpm supabase migration new qr_codes
```

- [ ] **Step 2: Write contents**

Paste into the new migration file:

```sql
-- QR codes: one default per owner, plus optional per-location codes.

create table qr_codes (
  id text primary key,                    -- nanoid(10)
  owner_id uuid not null references owners(id) on delete cascade,
  location_label text,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  archived_at timestamptz
);

create unique index one_default_qr_per_owner
  on qr_codes(owner_id)
  where is_default = true and archived_at is null;

create index qr_codes_owner_idx on qr_codes(owner_id);

alter table qr_codes enable row level security;

-- Owner can do anything with their own QR codes.
create policy "qr owner all"
  on qr_codes for all
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- Anonymous customer can read non-archived QRs (needed for branded landing).
create policy "qr anon read"
  on qr_codes for select
  to anon
  using (archived_at is null);
```

- [ ] **Step 3: Apply migration**

```powershell
pnpm supabase db push
```

- [ ] **Step 4: Verify**

Supabase dashboard → Table Editor → confirm `qr_codes` exists. Database → Policies → confirm two policies on `qr_codes`.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(db): create qr_codes table with RLS"
```

---

## Task 8: Database migration — `videos` table

**Files:**
- Create: `C:\Users\whirl\kollab_ai\supabase/migrations/0003_videos.sql`

- [ ] **Step 1: Create the migration file**

```powershell
pnpm supabase migration new videos
```

- [ ] **Step 2: Write contents**

Paste:

```sql
-- Videos: the submissions inbox.
-- Inserts happen exclusively server-side via the service-role key
-- (no INSERT policy for anon or authenticated).

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
  deleted_at timestamptz
);

create index videos_owner_created_idx
  on videos(owner_id, created_at desc)
  where deleted_at is null;

create index videos_owner_status_idx
  on videos(owner_id, status)
  where deleted_at is null;

create index videos_deleted_purge_idx
  on videos(deleted_at)
  where deleted_at is not null;

alter table videos enable row level security;

create policy "videos owner read"
  on videos for select
  using (owner_id = auth.uid() and deleted_at is null);

create policy "videos owner update"
  on videos for update
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- No INSERT or DELETE policy: server-side service role only.
```

- [ ] **Step 3: Apply**

```powershell
pnpm supabase db push
```

- [ ] **Step 4: Verify**

Confirm `videos` table exists with the three partial indexes and two RLS policies.

- [ ] **Step 5: Commit**

```powershell
git add supabase/migrations
git commit -m "feat(db): create videos table with RLS"
```

---

## Task 9: Create Supabase Storage buckets

**Files:** *(no code; configuration via Supabase dashboard)*

- [ ] **Step 1: Create `videos` bucket**

In Supabase dashboard → Storage → New bucket:
- Name: `videos`
- Public: **off**

- [ ] **Step 2: Create `thumbnails` bucket**

- Name: `thumbnails`
- Public: **off**

- [ ] **Step 3: Create `logos` bucket**

- Name: `logos`
- Public: **off**

- [ ] **Step 4: Verify**

Storage → confirm all three buckets present, all private.

*(Bucket-level RLS policies are added in Phase B when we wire actual access. For now, server-side service-role access is sufficient.)*

---

## Task 10: Generate TypeScript types from the database

**Files:**
- Create: `C:\Users\whirl\kollab_ai\lib/db/types.ts`

- [ ] **Step 1: Generate types**

```powershell
pnpm supabase gen types typescript --linked > lib/db/types.ts
```

- [ ] **Step 2: Verify**

Open `lib/db/types.ts`. Confirm it includes types for `Database['public']['Tables']['owners']`, `qr_codes`, and `videos`. The file should be ~200+ lines of generated types.

- [ ] **Step 3: Add a regen script to package.json**

Open `package.json` and add to the `scripts` block:

```json
"db:types": "supabase gen types typescript --linked > lib/db/types.ts"
```

- [ ] **Step 4: Commit**

```powershell
git add lib/db/types.ts package.json
git commit -m "chore(db): generate typescript types from schema"
```

---

## Task 11: Supabase client factories — browser

**Files:**
- Create: `C:\Users\whirl\kollab_ai\lib/supabase/client.ts`

- [ ] **Step 1: Write the browser client**

Create `lib/supabase/client.ts`:

```ts
import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/lib/db/types';

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```powershell
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```powershell
git add lib/supabase/client.ts
git commit -m "feat(auth): add browser supabase client factory"
```

---

## Task 12: Supabase client factories — server

**Files:**
- Create: `C:\Users\whirl\kollab_ai\lib/supabase/server.ts`

- [ ] **Step 1: Write the server client**

Create `lib/supabase/server.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/db/types';

export function createClient() {
  const cookieStore = cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — Next.js doesn't allow
            // cookie mutation there. Middleware refreshes cookies, so
            // this is a no-op outside of route handlers / actions.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 2: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/supabase/server.ts
git commit -m "feat(auth): add server supabase client factory"
```

---

## Task 13: Supabase client factories — admin (service role)

**Files:**
- Create: `C:\Users\whirl\kollab_ai\lib/supabase/admin.ts`

- [ ] **Step 1: Write the admin client**

Create `lib/supabase/admin.ts`:

```ts
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/db/types';

/**
 * Service-role client. Bypasses RLS. Server-only.
 * Used for: signed upload URL creation, video row inserts,
 * cross-owner administrative operations.
 */
export function createAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('createAdminClient called from a browser context');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
```

- [ ] **Step 2: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add lib/supabase/admin.ts
git commit -m "feat(auth): add service-role supabase client factory"
```

---

## Task 14: Middleware — session refresh and route gating

**Files:**
- Create: `C:\Users\whirl\kollab_ai\middleware.ts`
- Create: `C:\Users\whirl\kollab_ai\lib/supabase/middleware.ts`

- [ ] **Step 1: Write the middleware helper**

Create `lib/supabase/middleware.ts`:

```ts
import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@/lib/db/types';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // CRITICAL: must use getUser() (verifies token) not getSession()
  // (which trusts the cookie without verification).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isProtected =
    path.startsWith('/dashboard') || path.startsWith('/onboarding');
  const isAuthRoute = path.startsWith('/login') || path.startsWith('/auth');

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user && path === '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Write the middleware entry point**

Create `middleware.ts` at the project root:

```ts
import { updateSession } from '@/lib/supabase/middleware';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static assets and image optimizations.
  // Importantly: includes /c/* (customer landing) so anon session cookies
  // stay fresh, but does NOT redirect /c/* users to /login.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
```

- [ ] **Step 3: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```powershell
git add middleware.ts lib/supabase/middleware.ts
git commit -m "feat(auth): add session-refresh middleware with route gating"
```

---

## Task 15: Strip the default Next.js home page

**Files:**
- Modify: `C:\Users\whirl\kollab_ai\app/page.tsx`

- [ ] **Step 1: Replace the scaffolded home page**

Overwrite `app/page.tsx`:

```tsx
import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Kollab</h1>
      <p className="text-lg text-muted-foreground">
        Authentic video from the people actually at your tables.
      </p>
      <Link
        href="/login"
        className="rounded-md bg-foreground px-6 py-3 text-background font-medium hover:opacity-90"
      >
        Sign in
      </Link>
    </main>
  );
}
```

- [ ] **Step 2: Verify visually**

```powershell
pnpm dev
```

Open http://localhost:3000. Expect a centered "Kollab" headline, subtitle, and a "Sign in" button linking to `/login`. Stop the server.

- [ ] **Step 3: Commit**

```powershell
git add app/page.tsx
git commit -m "feat: replace default home page with kollab landing"
```

---

## Task 16: Login page

**Files:**
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/login/page.tsx`
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/login/login-form.tsx`
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/login/actions.ts`

- [ ] **Step 1: Write the server action that sends the magic link**

Create `app/(owner)/login/actions.ts`:

```ts
'use server';

import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';

const Schema = z.object({
  email: z.string().email(),
});

export type LoginResult =
  | { status: 'ok'; email: string }
  | { status: 'error'; message: string };

export async function sendMagicLink(formData: FormData): Promise<LoginResult> {
  const parsed = Schema.safeParse({ email: formData.get('email') });
  if (!parsed.success) {
    return { status: 'error', message: 'Please enter a valid email address.' };
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { status: 'error', message: error.message };
  }

  return { status: 'ok', email: parsed.data.email };
}
```

- [ ] **Step 2: Write the login form client component**

Create `app/(owner)/login/login-form.tsx`:

```tsx
'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { sendMagicLink, type LoginResult } from './actions';

export function LoginForm() {
  const [result, setResult] = useState<LoginResult | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      action={(formData) => {
        startTransition(async () => {
          const r = await sendMagicLink(formData);
          setResult(r);
        });
      }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@yourbusiness.com"
          disabled={isPending || result?.status === 'ok'}
        />
      </div>

      <Button type="submit" disabled={isPending || result?.status === 'ok'}>
        {isPending ? 'Sending…' : 'Send sign-in link'}
      </Button>

      {result?.status === 'ok' && (
        <p className="text-sm text-green-700">
          Check {result.email} — your sign-in link is on the way.
        </p>
      )}
      {result?.status === 'error' && (
        <p className="text-sm text-red-700">{result.message}</p>
      )}
    </form>
  );
}
```

- [ ] **Step 3: Write the login page**

Create `app/(owner)/login/page.tsx`:

```tsx
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in to Kollab</CardTitle>
        </CardHeader>
        <CardContent>
          <LoginForm />
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 5: Visual smoke test**

```powershell
pnpm dev
```

Open http://localhost:3000/login. Expect the card with email input and "Send sign-in link" button. Don't submit yet — we need the callback route first.

- [ ] **Step 6: Commit**

```powershell
git add "app/(owner)/login"
git commit -m "feat(auth): add login page with magic-link server action"
```

---

## Task 17: Auth callback route handler

**Files:**
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/auth/callback/route.ts`

- [ ] **Step 1: Write the route**

Create `app/(owner)/auth/callback/route.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    );
  }

  // Decide where to land: dashboard if branding is complete, else onboarding.
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const { data: owner } = await supabase
    .from('owners')
    .select('branding_complete')
    .eq('id', userData.user.id)
    .single();

  const destination = owner?.branding_complete ? '/dashboard' : '/onboarding/step-1';
  return NextResponse.redirect(`${origin}${destination}`);
}
```

- [ ] **Step 2: Verify compile**

```powershell
pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/auth"
git commit -m "feat(auth): add magic-link callback route with onboarding routing"
```

---

## Task 18: Placeholder dashboard page

**Files:**
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/dashboard/page.tsx`
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/dashboard/actions.ts`

- [ ] **Step 1: Write a sign-out server action**

Create `app/(owner)/dashboard/actions.ts`:

```ts
'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function signOut() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect('/login');
}
```

- [ ] **Step 2: Write the placeholder dashboard**

Create `app/(owner)/dashboard/page.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { signOut } from './actions';

export default async function DashboardPage() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();

  if (!data.user) {
    redirect('/login');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <p className="text-muted-foreground">
        Signed in as <span className="font-mono">{data.user.email}</span>
      </p>
      <p className="text-xs text-muted-foreground font-mono">
        user.id = {data.user.id}
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

- [ ] **Step 3: Commit**

```powershell
git add "app/(owner)/dashboard"
git commit -m "feat: placeholder dashboard with user id and sign-out"
```

---

## Task 19: Placeholder onboarding step 1

**Files:**
- Create: `C:\Users\whirl\kollab_ai\app/(owner)/onboarding/step-1/page.tsx`

- [ ] **Step 1: Write a stub page so the callback redirect works**

Create `app/(owner)/onboarding/step-1/page.tsx`:

```tsx
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createClient } from '@/lib/supabase/server';

export default async function OnboardingStep1Page() {
  const supabase = createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect('/login');

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Welcome to Kollab — Step 1 of 3</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-muted-foreground">
            Business basics will go here in Phase B.
          </p>
          <p className="text-xs text-muted-foreground font-mono">
            user.id = {data.user.id}
          </p>
          <Link
            href="/dashboard"
            className="text-sm underline text-muted-foreground"
          >
            Skip to dashboard (placeholder)
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Commit**

```powershell
git add "app/(owner)/onboarding"
git commit -m "feat: placeholder onboarding step 1"
```

---

## Task 20: End-to-end smoke test

**Files:** *(no code; manual verification)*

- [ ] **Step 1: Start the dev server**

```powershell
pnpm dev
```

- [ ] **Step 2: Walk the happy path**

1. Open http://localhost:3000 → see Kollab landing → click "Sign in".
2. At `/login`, enter your real email → submit.
3. Expect the success message: "Check [email] — your sign-in link is on the way."
4. Open your inbox. Within ~30 seconds, expect an email from `noreply@kollab.app` (or your sandbox sender) subject "Sign in to Kollab" with a magic link.
5. Click the magic link.
6. Expect to land on `/onboarding/step-1` (because `branding_complete` is false on a fresh owners row) — *not* `/dashboard`.
7. Confirm the page shows your `user.id` from `auth.getUser()`.
8. Visit `/dashboard` directly → confirm placeholder dashboard loads with your email and user.id.
9. Click "Sign out" → expect redirect to `/login`.
10. Try visiting `/dashboard` again → expect redirect to `/login` (middleware gate works).

- [ ] **Step 3: Verify the database side**

Open Supabase dashboard → Table Editor → `owners`. Confirm a row exists with your `user.id` as the primary key and `branding_complete = false`. This validates the `handle_new_user` trigger fired.

- [ ] **Step 4: Verify RLS on `videos` for sanity**

In Supabase dashboard → SQL Editor:

```sql
-- This should return 0 rows even though videos table has no rows yet:
-- the test is that the query runs without RLS errors.
select count(*) from videos;
```

Then test anon insert is blocked. In a new SQL Editor tab, click the role dropdown and switch to `anon`:

```sql
insert into videos (owner_id, qr_code_id, storage_path, mime_type, consent_text_snapshot)
values ('00000000-0000-0000-0000-000000000000', 'fake', 'fake', 'video/mp4', 'test');
```

Expected: `new row violates row-level security policy`. This confirms anon cannot insert.

- [ ] **Step 5: Tag the foundation**

```powershell
git tag -a phase-a-complete -m "Phase A: foundation, auth, and schema complete"
```

- [ ] **Step 6: Final commit (any cleanup)**

If any uncommitted changes remain from the smoke test:

```powershell
git status
# If clean, no commit needed.
```

Otherwise commit any small fixes and proceed.

---

## Phase A — Done

You now have:
- A Next.js + Tailwind + shadcn project skeleton, ready to extend
- Full v1 database schema deployed with RLS policies in production Supabase
- Storage buckets ready for videos, thumbnails, and logos
- Three Supabase client factories (browser / server / admin) for every access pattern v1 needs
- Magic-link auth working end-to-end via Resend → Supabase Auth → Next.js
- Route-gating middleware enforcing authenticated access to `/dashboard` and `/onboarding`
- Auto-provisioning of `owners` rows on `auth.users` insert via Postgres trigger
- Generated TypeScript types reflecting the live schema
- A placeholder dashboard and onboarding step-1 page proving the auth flow loop closes

**Next:** Phase B — Owner onboarding (business basics, logo upload, QR generation with print-ready PDF). To be planned with a separate writing-plans invocation when ready to execute.
