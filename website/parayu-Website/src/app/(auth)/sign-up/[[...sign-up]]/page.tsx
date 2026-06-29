import { Suspense } from "react";
import { AuthForm } from "@/components/auth/auth-form";

export default function SignUpPage() {
  return (
    <div className="flex flex-col items-center justify-center w-full">
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Join Parayu AI</h1>
        <p className="text-zinc-400">Create an account to start working 4x faster.</p>
      </div>
      <Suspense>
        <AuthForm mode="sign-up" />
      </Suspense>
    </div>
  );
}
