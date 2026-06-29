# Parayu Website — Go Live (Vercel + Supabase + Razorpay)

This site is a Next.js 16 app. **Auth AND backend = Supabase** (no Clerk),
payments = **Razorpay**. Below is the exact path from local code to a live site.

## 1. Supabase (auth + backend)

1. Create a project at https://supabase.com.
2. Open **SQL Editor** and run [`supabase/schema.sql`](supabase/schema.sql). This
   creates `users` (1:1 with `auth.users`), `voice_notes`, `ai_commands`, RLS
   policies, and a trigger that auto-creates a profile row on every signup.
3. From **Project Settings → API**, copy:
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` secret key → `SUPABASE_SERVICE_ROLE_KEY` *(server only)*
4. **Auth → URL Configuration**: add your site URL and
   `https://YOUR-DOMAIN/auth/callback` to the redirect allow-list. For Google
   login, enable the Google provider under **Auth → Providers**.
5. **Make yourself an admin** (after you sign up once):
   ```sql
   UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';
   ```
   Only `is_admin = true` users can reach `/admin`.

> Auth is Supabase Auth. Sign-in/up live at `/sign-in` and `/sign-up`; the
> `proxy.ts` (Next's renamed middleware) refreshes sessions and guards
> `/dashboard` + `/admin`. The admin panel reads live data via the service-role
> key, so keep it server-only.

## 3. Razorpay payments

1. In the **Razorpay Dashboard** (start in **Test Mode**):
   - **Settings → API Keys → Generate Key** → `RAZORPAY_KEY_ID` + `RAZORPAY_KEY_SECRET`.
2. After the site is deployed (step 4), add a **Webhook**:
   - **Settings → Webhooks → Add New Webhook**
   - URL: `https://YOUR-DOMAIN/api/razorpay/webhook`
   - Active event: **`payment.captured`**
   - Set a secret → put it in `RAZORPAY_WEBHOOK_SECRET`.
3. Plan prices live in [`src/lib/plans.ts`](src/lib/plans.ts) (amounts in paise).
   Keep them in sync with the pricing page.

How payment flows:
`Pricing button → POST /api/razorpay/order → Razorpay Checkout →
POST /api/razorpay/verify (signature check → set plan_tier)`, with the
`/api/razorpay/webhook` as the authoritative server-side backup.

## 4. Deploy to Vercel

1. Push this folder to its own GitHub repo (it's a standalone Next.js project):
   ```bash
   cd parayu-Website
   git init && git add . && git commit -m "Parayu website"
   git remote add origin git@github.com:YOU/parayu-website.git
   git push -u origin main
   ```
2. At https://vercel.com → **Add New → Project** → import the repo.
3. In **Project → Settings → Environment Variables**, add every key from
   [`.env.local.example`](.env.local.example) with your real values.
4. Deploy. Then go back to **Razorpay → Webhooks** and set the URL to your live
   domain (step 3.2).
5. Test a payment in Razorpay **Test Mode** end-to-end, then switch the keys to
   **Live Mode** when you're ready to take real money.

## Local development

```bash
cp .env.local.example .env.local   # fill in real values
npm install
npm run dev                        # http://localhost:3000
```
