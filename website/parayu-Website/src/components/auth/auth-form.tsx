"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Email/password auth backed by Supabase, used by both /sign-in and /sign-up.
export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get("redirect") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    try {
      if (mode === "sign-up") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { first_name: name },
            emailRedirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
          },
        });
        if (error) throw error;
        // If email confirmation is on, there's no session yet.
        if (!data.session) {
          toast.success("Check your email to confirm your account.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`,
      },
    });
    if (error) toast.error(error.message);
  }

  return (
    <div className="w-full max-w-md mx-auto bg-zinc-900 border border-white/5 shadow-2xl rounded-2xl p-8">
      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "sign-up" && (
          <div>
            <label className="block text-sm text-zinc-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none"
              placeholder="Your name"
            />
          </div>
        )}
        <div>
          <label className="block text-sm text-zinc-300 mb-1.5">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="block text-sm text-zinc-300 mb-1.5">Password</label>
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none"
            placeholder="••••••••"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
        >
          {loading ? "Please wait…" : mode === "sign-up" ? "Create account" : "Sign in"}
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs text-zinc-500">or</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      <Button
        type="button"
        onClick={handleGoogle}
        variant="outline"
        className="w-full h-11 border-white/10 hover:bg-white/5 text-white"
      >
        Continue with Google
      </Button>

      <p className="text-sm text-zinc-400 text-center mt-6">
        {mode === "sign-up" ? (
          <>Already have an account? <Link href="/sign-in" className="text-primary hover:underline">Sign in</Link></>
        ) : (
          <>New to Parayu? <Link href="/sign-up" className="text-primary hover:underline">Create an account</Link></>
        )}
      </p>
    </div>
  );
}
