import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Welcome back to Parayu</h1>
        <p className="text-zinc-400">Sign in to your voice workspace.</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-in" />
      </Suspense>
    </div>
  );
}
