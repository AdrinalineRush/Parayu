import Link from "next/link";
import { Shield, Users, CreditCard, Activity, Ticket, FileText, Share2, Building2, ListOrdered, Lock, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const navItems = [
    { name: "Admin Dashboard", href: "/admin", icon: <Shield className="w-5 h-5" /> },
    { name: "Users", href: "/admin/users", icon: <Users className="w-5 h-5" /> },
    { name: "Subscriptions", href: "/admin/subscriptions", icon: <CreditCard className="w-5 h-5" /> },
    { name: "Revenue", href: "/admin/revenue", icon: <Activity className="w-5 h-5" /> },
    { name: "Support Tickets", href: "/admin/tickets", icon: <Ticket className="w-5 h-5" /> },
    { name: "Blog CMS", href: "/admin/blog", icon: <FileText className="w-5 h-5" /> },
    { name: "Affiliates", href: "/admin/affiliates", icon: <Share2 className="w-5 h-5" /> },
    { name: "Enterprise", href: "/admin/enterprise", icon: <Building2 className="w-5 h-5" /> },
    { name: "Audit Logs", href: "/admin/audit-logs", icon: <ListOrdered className="w-5 h-5" /> },
    { name: "Security", href: "/admin/security", icon: <Lock className="w-5 h-5" /> },
  ];

  return (
    <div className="dark min-h-screen bg-background flex">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r border-primary/20 bg-background flex flex-col relative overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-violet-500 to-transparent"></div>
        <div className="p-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-500 flex items-center justify-center text-white shadow-[0_0_15px_rgba(239,68,68,0.3)]">
              <Shield className="w-4 h-4" />
            </div>
            <span className="font-heading font-bold text-xl text-white">Super Admin</span>
          </Link>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
            >
              {item.icon}
              {item.name}
            </Link>
          ))}
        </nav>
        
        <div className="p-4 border-t border-white/5">
          <form action="/auth/signout" method="post" className="glass-card border-red-500/20 p-4 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center text-white text-sm font-semibold shrink-0">
              {(user?.email?.[0] ?? "A").toUpperCase()}
            </div>
            <div className="flex flex-col flex-1 min-w-0">
              <span className="text-sm font-medium text-white truncate">{user?.email ?? "System Admin"}</span>
              <span className="text-xs text-red-400">Admin access</span>
            </div>
            <button type="submit" title="Sign out" className="text-zinc-400 hover:text-white transition-colors shrink-0">
              <LogOut className="w-4 h-4" />
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="h-16 border-b border-white/5 bg-background/50 flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            <h2 className="text-sm font-medium text-red-400 uppercase tracking-widest">Admin Console</h2>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10 overflow-y-auto bg-background">
          {children}
        </main>
      </div>
    </div>
  );
}
