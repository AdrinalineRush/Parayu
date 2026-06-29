"use client";

import { useEffect, useState } from "react";
import { CalendarHeart, Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

type LaunchSoonButtonProps = {
  children: React.ReactNode;
  className?: string;
};

export function LaunchSoonButton({ children, className }: LaunchSoonButtonProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    const timer = window.setTimeout(() => setOpen(false), 3600);
    return () => window.clearTimeout(timer);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(className)}
      >
        {children}
      </button>

      {open && (
        <div className="fixed inset-x-4 top-24 z-[100] mx-auto max-w-sm animate-in fade-in slide-in-from-top-3 duration-200">
          <div className="relative overflow-hidden rounded-2xl border border-[#e01e41]/20 bg-white/95 p-4 pr-11 shadow-[0_18px_60px_rgba(28,27,25,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-zinc-950/95">
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-[#e01e41]/10 blur-2xl" />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-3 rounded-full p-1 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-white/10 dark:hover:text-white"
              aria-label="Close launch message"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="relative flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e01e41]/10 text-[#e01e41]">
                <CalendarHeart className="h-5 w-5" />
              </div>
              <div>
                <div className="mb-1 flex items-center gap-1.5 text-sm font-black text-zinc-950 dark:text-white">
                  <Sparkles className="h-3.5 w-3.5 text-[#e01e41]" />
                  Launch date announced soon
                </div>
                <p className="text-sm font-semibold leading-relaxed text-zinc-600 dark:text-zinc-300">
                  Parayu is still in cozy dev testing. We will open downloads as soon as the launch date is ready.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
