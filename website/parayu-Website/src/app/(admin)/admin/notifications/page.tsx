import { Badge } from "@/components/ui/badge";
import { Bell } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sendNotification } from "./actions";

export const dynamic = "force-dynamic";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  audience: string | null;
  created_at: string;
}

export default async function NotificationsPage() {
  const { data } = await supabaseAdmin()
    .from("notifications")
    .select("id, title, body, audience, created_at")
    .order("created_at", { ascending: false });

  const notifications: Notification[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Notifications</h1>
        <p className="text-zinc-400">Broadcast announcements to your users. Live from Supabase.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">New broadcast</h2>
        <form action={sendNotification} className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-4">
            <input name="title" required placeholder="Title" className="sm:col-span-2 rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none" />
            <select name="audience" defaultValue="all" className="rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none">
              <option value="all">All users</option>
              <option value="pro">Pro</option>
              <option value="team">Team</option>
            </select>
          </div>
          <textarea name="body" rows={3} placeholder="Message" className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none resize-y" />
          <button type="submit" className="h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors">Send broadcast</button>
        </form>
      </div>

      <div className="space-y-3">
        {notifications.length === 0 && (
          <div className="glass-card p-6 text-sm text-zinc-500 text-center">
            <Bell className="w-5 h-5 mx-auto mb-2 opacity-50" /> No notifications sent yet.
          </div>
        )}
        {notifications.map((n) => (
          <div key={n.id} className="glass-card p-5">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h3 className="font-semibold text-white">{n.title}</h3>
              <Badge className="rounded-md text-[10px] bg-primary/10 text-primary border-primary/20 capitalize">{n.audience ?? "all"}</Badge>
            </div>
            {n.body && <p className="text-sm text-zinc-300">{n.body}</p>}
            <p className="text-[10px] text-zinc-500 font-mono mt-2">{new Date(n.created_at).toLocaleString("en-IN")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
