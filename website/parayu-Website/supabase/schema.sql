-- Parayu AI Supabase SQL Schema (Supabase Auth edition)
-- Run this in your Supabase SQL Editor. Auth is handled by Supabase Auth, so
-- public.users.id is the auth.users UUID, and a trigger auto-creates the profile
-- row on signup.

-- 1. Users table (1:1 with auth.users) -------------------------------------
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  profile_image_url TEXT,
  plan_tier TEXT DEFAULT 'free',        -- 'free' | 'pro' | 'team' | 'enterprise'
  is_admin BOOLEAN DEFAULT false,        -- flip to true to grant /admin access
  status TEXT DEFAULT 'active',          -- 'active' | 'suspended' (admin-controlled)
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 1b. Payments (one row per successful Razorpay charge) --------------------
CREATE TABLE public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT,
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT UNIQUE,       -- dedupes verify + webhook double-writes
  plan TEXT,                             -- 'pro' | 'team'
  cycle TEXT,                            -- 'monthly' | 'annual'
  amount INTEGER,                        -- paise (INR × 100)
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'captured',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 2. Voice notes (History) -------------------------------------------------
CREATE TABLE public.voice_notes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  transcript TEXT NOT NULL,
  formatted_output TEXT,
  duration_seconds INTEGER DEFAULT 0,
  words_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 3. AI commands -----------------------------------------------------------
CREATE TABLE public.ai_commands (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  trigger_word TEXT NOT NULL,
  prompt_template TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- 4. Auto-create a profile row whenever someone signs up ------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, first_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', NEW.raw_user_meta_data->>'full_name')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Row Level Security ----------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Payments: a user can read their own; admin reads all via service role.
CREATE POLICY "Users can view own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

-- Users: a user sees/edits only their own row (auth.uid() = id, both UUID).
CREATE POLICY "Users can view own profile" ON public.users
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- Voice notes
CREATE POLICY "Users can view own notes" ON public.voice_notes
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own notes" ON public.voice_notes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own notes" ON public.voice_notes
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notes" ON public.voice_notes
  FOR DELETE USING (auth.uid() = user_id);

-- AI commands
CREATE POLICY "Users can view own commands" ON public.ai_commands
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own commands" ON public.ai_commands
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own commands" ON public.ai_commands
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own commands" ON public.ai_commands
  FOR DELETE USING (auth.uid() = user_id);

-- NOTE: The admin panel reads aggregate data with the service-role key (server
-- side), which bypasses RLS — so no broad "admins can read all" policy is needed
-- here. To make YOUR account an admin after signing up, run:
--   UPDATE public.users SET is_admin = true WHERE email = 'you@example.com';

-- ==========================================================================
-- 6. Admin modules ---------------------------------------------------------
-- Tables backing the admin sub-pages. Admin reads/writes go through the
-- service-role key (server-side), which bypasses RLS. We still enable RLS and
-- add narrow policies for the few user-facing paths (e.g. submitting a ticket).
-- ==========================================================================

CREATE TABLE public.support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',     -- 'low' | 'normal' | 'high'
  status TEXT DEFAULT 'open',         -- 'open' | 'resolved'
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_email TEXT,
  action TEXT NOT NULL,
  target TEXT,
  meta JSONB,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.affiliates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  email TEXT,
  code TEXT UNIQUE NOT NULL,
  referrals INTEGER DEFAULT 0,
  earnings INTEGER DEFAULT 0,          -- paise
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.enterprise_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company TEXT NOT NULL,
  email TEXT NOT NULL,
  seats INTEGER,
  message TEXT,
  status TEXT DEFAULT 'new',           -- 'new' | 'contacted' | 'won' | 'lost'
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  body TEXT,
  published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  updated_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

CREATE TABLE public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  body TEXT,
  audience TEXT DEFAULT 'all',         -- 'all' | 'pro' | 'team'
  created_at TIMESTAMPTZ DEFAULT timezone('utc', now()) NOT NULL
);

-- RLS for admin modules
ALTER TABLE public.support_tickets  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.affiliates       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enterprise_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications    ENABLE ROW LEVEL SECURITY;

-- Users may file and read their own support tickets.
CREATE POLICY "Users insert own tickets" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own tickets" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Published blog posts are world-readable (for the public /blog page).
CREATE POLICY "Anyone can read published posts" ON public.blog_posts
  FOR SELECT USING (published = true);

-- Anyone can submit an enterprise lead from the public site.
CREATE POLICY "Anyone can submit a lead" ON public.enterprise_leads
  FOR INSERT WITH CHECK (true);

-- Optional seed for feature flags:
-- INSERT INTO public.feature_flags (key, description, enabled) VALUES
--   ('malayalam_beta', 'Malayalam translation beta', true),
--   ('team_workspaces', 'Shared team dictionaries', false);
