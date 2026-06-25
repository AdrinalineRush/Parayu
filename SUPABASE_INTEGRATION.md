# Parayu — Supabase Integration Spec

Design document for unifying the website, subscriptions, and the developer-curated
global dictionary onto a single **Supabase** backend. Nothing here is built yet —
this is the spec to build the website + backend against. The macOS app is already
wired to consume it with a one-line change (see §6).

---

## 1. The big picture

Single source of truth = Supabase. Three clients talk to it:

```
                    ┌──────────────────────────────┐
                    │            SUPABASE            │
                    │  Postgres + Auth + Edge Funcs  │
                    │  • dictionary_entries          │
                    │  • dictionary_meta (version)   │
                    │  • profiles (plan/subscription)│
                    └───────┬───────────┬───────────┘
            write (authed)  │           │  read (anon)
        ┌───────────────────┴──┐   ┌────┴───────────────────┐
        │ Website admin console│   │  Public macOS app      │
        │ DMG admin panel      │   │  (all users)           │
        │  ↑ both sign in as    │   │  • GET dictionary JSON │
        │    the admin user     │   │  • read own plan       │
        └──────────────────────┘   └────────────────────────┘
```

"Website admin ↔ DMG admin connected directly" = both authenticate as the admin
user and write to the **same** tables; they stay in sync automatically. There is
no direct app↔website link; the shared backend is the connection.

GitHub goes back to hosting only the **website code** (one repo, your main project
name — landing page + subscription page + admin console). The dictionary **data**
lives in Supabase, not in a repo file.

---

## 2. Repository layout (suggested monorepo)

```
parayu/                      # main GitHub repo (your product name)
├── apps/
│   ├── web/                 # Next.js site on Vercel (landing + pricing + admin)
│   └── desktop/             # this Electron app (or keep it in its own repo)
├── supabase/
│   ├── migrations/          # SQL schema (§3)
│   └── functions/
│       └── global-dictionary/   # Edge Function the app fetches (§4)
└── README.md
```

The desktop app can stay in its current separate repo; only `REMOTE_URL` needs to
point at the Supabase Edge Function. The web app + supabase/ are the new work.

---

## 3. Database schema

```sql
-- ─── Global dictionary entries (the editable working set) ───────────────────
create table public.dictionary_entries (
  id          uuid primary key default gen_random_uuid(),
  from_text   text not null,
  to_text     text not null,
  phrase      boolean not null default false,   -- substring vs whole-word
  stage       text not null default 'post'
                check (stage in ('pre','post')), -- 'pre'=Malayalam script, 'post'=English
  enabled     boolean not null default true,
  notes       text,                             -- admin-only context, never served
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── A single meta row holding the published version counter ────────────────
create table public.dictionary_meta (
  id          int primary key default 1 check (id = 1),
  version     int not null default 1,
  updated_at  timestamptz not null default now()
);
insert into public.dictionary_meta (id, version) values (1, 1);

-- ─── User profiles / subscription state (1:1 with auth.users) ───────────────
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  plan            text not null default 'Base Plan'
                    check (plan in ('Base Plan','Pro Plan','Enterprise Plan')),
  plan_expires_at timestamptz,
  is_admin        boolean not null default false,  -- gate for dictionary writes
  created_at      timestamptz not null default now()
);
```

**Publishing model:** admin edits rows in `dictionary_entries` freely. Hitting
**Publish** bumps `dictionary_meta.version` (and `updated_at`). The app only
re-downloads when the served `version` is higher than its cached one — identical
to the logic already in the app.

---

## 4. Serving the dictionary to the app (Edge Function)

The app expects this exact JSON shape (same as today's bundled file):

```json
{ "version": 7, "updated": "2026-06-24",
  "entries": [ { "from": "...", "to": "...", "phrase": false, "stage": "post" } ] }
```

So expose an Edge Function `global-dictionary` that assembles it:

```ts
// supabase/functions/global-dictionary/index.ts  (pseudocode)
const meta = await db.from('dictionary_meta').select('version,updated_at').single();
const rows = await db.from('dictionary_entries')
  .select('from_text,to_text,phrase,stage').eq('enabled', true);
return json({
  version: meta.version,
  updated: meta.updated_at.slice(0,10),
  entries: rows.map(r => ({ from: r.from_text, to: r.to_text, phrase: r.phrase, stage: r.stage }))
}, { headers: { 'Cache-Control': 'public, max-age=300' } });  // 5-min CDN cache
```

Public URL becomes e.g.
`https://<project>.functions.supabase.co/global-dictionary`
or, branded, route `https://parayu.online/api/global-dictionary` through Vercel to it.

> **Why an Edge Function and not direct table reads?** It returns the app's exact
> JSON shape (zero app rework beyond the URL), it's CDN-cacheable, and it hides
> table structure. Direct anon `select` is also possible but would require the app
> to assemble the JSON and a public-read RLS policy on the table.

---

## 5. Auth & Row-Level Security

Anon key is **public by design** (safe to ship in the app and the website). RLS is
what actually protects writes.

```sql
alter table public.dictionary_entries enable row level security;
alter table public.dictionary_meta    enable row level security;
alter table public.profiles           enable row level security;

-- Dictionary: only admins may read/write the raw table (the Edge Function uses
-- the service role internally, so the public never needs table-level read).
create policy admin_rw_entries on public.dictionary_entries
  for all using (exists (select 1 from public.profiles p
                         where p.id = auth.uid() and p.is_admin))
          with check (exists (select 1 from public.profiles p
                         where p.id = auth.uid() and p.is_admin));

create policy admin_rw_meta on public.dictionary_meta
  for all using (exists (select 1 from public.profiles p
                         where p.id = auth.uid() and p.is_admin))
          with check (exists (select 1 from public.profiles p
                         where p.id = auth.uid() and p.is_admin));

-- Profiles: a user can read/update only their own row; nobody self-promotes to admin.
create policy self_read   on public.profiles for select using (auth.uid() = id);
create policy self_update on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id and is_admin = (select is_admin from public.profiles where id = auth.uid()));
```

You become admin once, manually: `update public.profiles set is_admin = true where email = 'achuvijayan@gmail.com';`

**Both admin clients (website + DMG) sign in as you** via Supabase Auth and write
through these policies. **No service_role key is ever shipped** — not in the public
app, not even in the dev DMG. (The service role lives only inside the Edge Function
on Supabase's servers.)

---

## 6. macOS app changes (small, mostly done)

1. **Fetch** — set `REMOTE_URL` in `src/globalDictionary.js` to the Edge Function
   URL. The existing `fetchJson` + version-gating + bundled-fallback all work
   unchanged because the shape matches.
2. **DMG admin "Publish"** — swap the GitHub Contents API call in
   `src/admin/adminMain.js` for: sign-in (Supabase Auth) → `upsert` rows into
   `dictionary_entries` → bump `dictionary_meta.version`. The admin **UI** stays
   identical; only the publish target changes (~30 min).
3. **Subscription gating** — the app already gates Malayalam translate on
   `userProfile.plan` (`src/whisper.js`). After Supabase Auth login, fetch the
   user's `profiles.plan` and store it in `userProfile.plan`; the existing checks
   then enforce it. Add a periodic/refresh-on-launch re-fetch so expiry applies.

The bundled `assets/global-dictionary.json` remains the offline fallback.

---

## 7. Subscriptions flow

1. User signs up on `parayu.online` (Supabase Auth) → a `profiles` row is created
   (via trigger on `auth.users`).
2. Pricing page → checkout with **Stripe** (global) or **Razorpay** (India/UPI).
3. Provider **webhook → Supabase Edge Function** updates `profiles.plan` and
   `plan_expires_at` on payment success / renewal / cancellation.
4. The desktop app and website both read `profiles.plan` to unlock Pro features
   (Malayalam translation, premium AI cleanup, etc.).

```sql
-- Auto-create a profile when a user signs up.
create function public.handle_new_user() returns trigger language plpgsql
security definer as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

---

## 8. Website admin console (on parayu.online)

- A protected route (e.g. `/admin`) behind Supabase Auth; visible only when the
  logged-in user has `is_admin = true`.
- Same CRUD as the DMG admin panel: list/add/edit/remove `dictionary_entries`
  (with `stage` + `phrase`), then **Publish** (bump `dictionary_meta.version`).
- This is the URL the DMG admin panel's "Open Website Admin" button points to.

---

## 9. Build order when you're ready

1. Create Supabase project; run migrations (§3); set yourself `is_admin`.
2. Deploy the `global-dictionary` Edge Function (§4); seed it from the current
   `assets/global-dictionary.json`.
3. Point the app's `REMOTE_URL` at the function → remote sync is live for users.
4. Build the website (landing + pricing + admin) on Vercel against Supabase.
5. Repoint the DMG admin "Publish" to Supabase (§6.2).
6. Wire subscriptions (§7) and the app's plan refresh (§6.3).

---

## 10. Security checklist

- [ ] Only the anon key ships in clients; service_role stays server-side only.
- [ ] RLS enabled on every table; writes gated by `is_admin`.
- [ ] No user can self-promote to admin (policy in §5).
- [ ] Payment plan changes happen **only** via verified provider webhooks, never
      from the client.
- [ ] Edge Function sets a sane `Cache-Control` so the app/CDN don't hammer it.
- [ ] App keeps the bundled dictionary fallback for offline / outage.
```
