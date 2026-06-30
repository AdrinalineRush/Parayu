"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LaunchSoonButton } from "@/components/marketing/launch-soon-button";

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  const [activeMenu, setActiveMenu] = useState<"product" | "use-cases" | "resources" | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed z-50 top-0 left-0 right-0 transition-all duration-300",
        scrolled 
          ? "bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md border-b border-zinc-200 dark:border-white/5 py-4 shadow-sm" 
          : "bg-transparent py-6"
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 flex items-center justify-center transition-all duration-300 group-hover:scale-105 group-hover:rotate-[-2deg]">
              <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain filter drop-shadow-[0_2px_8px_rgba(124,92,255,0.2)]" />
            </div>
            <span className="font-heading font-bold text-xl text-zinc-950 dark:text-white tracking-tight">Parayu</span>
          </Link>
          
          <nav className="hidden lg:flex items-center gap-6">
            {/* Product Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => setActiveMenu("product")}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <Link href="/features" className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer">
                Product <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform duration-200", activeMenu === "product" && "rotate-180")} />
              </Link>
              
              {activeMenu === "product" && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 z-50">
                  <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-[#e8e5df] dark:border-zinc-800 rounded-2xl p-3 shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link href="/features" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Features</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Core capabilities of our offline voice client.</span>
                    </Link>
                    <Link href="/commands" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">AI Commands</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Local voice-activated text formatting.</span>
                    </Link>
                    <Link href="/languages" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Supported Languages</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Malayalam, English, and 99+ local languages.</span>
                    </Link>
                    <Link href="/integrations" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Integrations</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Pasting system-wide into all your tools.</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Use Cases Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => setActiveMenu("use-cases")}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <Link href="/use-cases" className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer">
                Use Cases <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform duration-200", activeMenu === "use-cases" && "rotate-180")} />
              </Link>
              
              {activeMenu === "use-cases" && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 z-50">
                  <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-[#e8e5df] dark:border-zinc-800 rounded-2xl p-3 shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link href="/use-cases" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Overview</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Tailored voice workflows for every role.</span>
                    </Link>
                    <Link href="/use-cases/developers" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">For Developers</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">PRs, commits, terminal, and code syntax.</span>
                    </Link>
                    <Link href="/use-cases/content-creators" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">For Content Creators</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Drafting script, social copy, and outline.</span>
                    </Link>
                    <Link href="/use-cases/founders" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">For Founders & Execs</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Drafting email, slack, and update offline.</span>
                    </Link>
                    <Link href="/use-cases/students" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">For Students</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Local notes, exam study, and outline.</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            {/* Resources Dropdown */}
            <div 
              className="relative py-2"
              onMouseEnter={() => setActiveMenu("resources")}
              onMouseLeave={() => setActiveMenu(null)}
            >
              <Link href="/docs" className="flex items-center gap-1 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors cursor-pointer">
                Resources <ChevronDown className={cn("w-4 h-4 opacity-50 transition-transform duration-200", activeMenu === "resources" && "rotate-180")} />
              </Link>
              
              {activeMenu === "resources" && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 w-80 z-50">
                  <div className="bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-[#e8e5df] dark:border-zinc-800 rounded-2xl p-3 shadow-2xl flex flex-col gap-1 animate-in fade-in slide-in-from-top-2 duration-200">
                    <Link href="/docs" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Documentation</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Quickstart setup, shortcuts, and dictionary.</span>
                    </Link>
                    <Link href="/help" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Help Center</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Frequently asked questions and guides.</span>
                    </Link>
                    <Link href="/blog" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Blog</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Latest updates, tutorials, and features.</span>
                    </Link>
                    <Link href="/parayu-vs-wispr-flow" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">vs Wispr Flow</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Detailed offline local vs cloud comparison.</span>
                    </Link>
                    <Link href="/affiliate" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Affiliate Program</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Earn recurring partner commissions.</span>
                    </Link>
                    <Link href="/media-kit" className="group/item flex flex-col p-2.5 rounded-xl hover:bg-[#f6f4f0] dark:hover:bg-zinc-800 transition-colors">
                      <span className="text-sm font-bold text-[#1c1b19] dark:text-zinc-100 group-hover/item:text-[#e01e41] transition-colors">Media Kit</span>
                      <span className="text-xs text-[#706b61] dark:text-zinc-400 mt-0.5">Official logos and transparent assets.</span>
                    </Link>
                  </div>
                </div>
              )}
            </div>

            <Link href="/enterprise" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">Enterprise</Link>
            <Link href="/pricing" className="text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">Pricing</Link>
          </nav>
        </div>
 
        <div className="flex items-center gap-6">
          <ThemeToggle />
          <Link href="/sign-in" className="hidden sm:block text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-950 dark:hover:text-white transition-colors">
            Log in
          </Link>
          <LaunchSoonButton className="inline-flex h-9 items-center justify-center rounded-xl bg-primary px-6 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary/90">
            Download
          </LaunchSoonButton>
        </div>
      </div>
    </header>
  );
}
