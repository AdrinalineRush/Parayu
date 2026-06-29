import Link from "next/link";
import { Home, History, Book, FileCode2, Settings, Check, LogOut, Zap } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { SidebarNav } from "@/components/shared/sidebar-nav";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("users").select("plan_tier").eq("id", user.id).single()
    : { data: null };
  const plan = profile?.plan_tier ?? "free";

  const navItems = [
    { name: "Home", href: "/dashboard", icon: <Home className="w-5 h-5" /> },
    { name: "Parayu History", href: "/dashboard/history", icon: <History className="w-5 h-5" /> },
    { name: "Dictionary", href: "/dashboard/dictionary", icon: <Book className="w-5 h-5" /> },
    { name: "Snippets", href: "/dashboard/snippets", icon: <FileCode2 className="w-5 h-5" /> },
    { name: "Settings", href: "/dashboard/settings", icon: <Settings className="w-5 h-5" /> },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-64 border-r border-border bg-secondary hidden md:flex flex-col justify-between">
        <div className="flex flex-col flex-grow">
          {/* Logo container */}
          <div className="p-6">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-9 h-9 rounded-xl border border-border p-1.5 bg-card shadow-sm flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Parayu Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-heading font-bold text-xl text-foreground">Parayu</span>
            </Link>
          </div>
          
          {/* Navigation Links */}
          <SidebarNav navItems={navItems} />
        </div>
        
        {/* Sidebar Bottom Widgets */}
        <div className="flex flex-col gap-2">
          {/* License Widget */}
          <div className="p-4 border-t border-border">
            {plan === "free" ? (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-start gap-2 relative">
                <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                  <Zap className="w-4.5 h-4.5" />
                </div>
                <span className="font-heading font-bold text-sm text-foreground mt-1">Free Plan</span>
                <span className="text-xs text-muted-foreground leading-relaxed font-semibold">
                  Upgrade to Pro for Malayalam translation &amp; AI tone styling.
                </span>
                <Link href="/pricing" className="w-full">
                  <button className="border border-primary text-primary font-bold hover:bg-primary/10 rounded-xl py-2 w-full text-center text-xs mt-2 transition-all cursor-pointer">
                    Upgrade to Pro
                  </button>
                </Link>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-2xl p-5 shadow-sm flex flex-col items-start gap-2 relative">
                <div className="w-7 h-7 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                  <Check className="w-4.5 h-4.5" />
                </div>
                <span className="font-heading font-bold text-sm text-foreground mt-1">Pro Plan Active</span>
                <span className="text-xs text-muted-foreground leading-relaxed font-semibold">
                  Enjoy Malayalam translation &amp; premium AI cleanup features.
                </span>
                <Link href="/dashboard/subscription" className="w-full">
                  <button className="border border-border text-primary font-bold hover:bg-primary/10 rounded-xl py-2 w-full text-center text-xs mt-2 transition-all cursor-pointer">
                    Manage License
                  </button>
                </Link>
              </div>
            )}
          </div>

          {/* User Profile Badge */}
          <div className="p-4 border-t border-border flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-[#ff5d42] flex items-center justify-center text-white text-sm font-bold shrink-0 shadow-sm">
              AR
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-bold text-foreground truncate">Arjun Raj</span>
              <span className="text-xs text-muted-foreground font-semibold capitalize">{plan} Plan</span>
            </div>
            <form action="/auth/signout" method="post" className="shrink-0 flex items-center">
              <button type="submit" title="Sign out" className="text-muted-foreground hover:text-primary transition-colors cursor-pointer p-1">
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Topbar */}
        <header className="h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
          <h2 className="text-lg font-bold text-foreground md:hidden">Parayu</h2>
          <div className="hidden md:flex flex-1 justify-end items-center gap-4">
            <button className="text-sm text-muted-foreground font-semibold hover:text-primary transition-colors bg-secondary px-4 py-1.5 rounded-full border border-border cursor-pointer">
              ⌘K Search
            </button>
            <div className="w-8 h-8 rounded-full bg-secondary border border-border flex items-center justify-center relative">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
            </div>
            <ThemeToggle />
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-grow p-6 lg:p-10 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
