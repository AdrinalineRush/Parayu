import { Badge } from "@/components/ui/badge";
import { FileText, Trash2 } from "lucide-react";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { createPost, togglePublish, deletePost } from "./actions";

export const dynamic = "force-dynamic";

interface Post {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published: boolean | null;
  created_at: string;
}

export default async function BlogCmsPage() {
  const { data } = await supabaseAdmin()
    .from("blog_posts")
    .select("id, title, slug, excerpt, published, created_at")
    .order("created_at", { ascending: false });

  const posts: Post[] = data ?? [];

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2 text-white">Blog CMS</h1>
        <p className="text-zinc-400">{posts.length} posts · {posts.filter((p) => p.published).length} published.</p>
      </div>

      <div className="glass-card p-6">
        <h2 className="text-lg font-bold text-white mb-4">New post</h2>
        <form action={createPost} className="space-y-4">
          <input name="title" required placeholder="Title" className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none" />
          <input name="excerpt" placeholder="Short excerpt" className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none" />
          <textarea name="body" rows={4} placeholder="Body (markdown/plain text)" className="w-full rounded-lg bg-background border border-white/10 text-white px-3 py-2.5 focus:border-violet-500 outline-none resize-y" />
          <button type="submit" className="h-11 px-6 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-semibold transition-colors">Create draft</button>
        </form>
      </div>

      <div className="space-y-3">
        {posts.length === 0 && (
          <div className="glass-card p-6 text-sm text-zinc-500 text-center">
            <FileText className="w-5 h-5 mx-auto mb-2 opacity-50" /> No posts yet.
          </div>
        )}
        {posts.map((p) => (
          <div key={p.id} className="glass-card p-5 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-white truncate">{p.title}</h3>
                <Badge className={`rounded-md text-[10px] ${p.published ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-zinc-700/40 text-zinc-400 border-white/5"}`}>
                  {p.published ? "published" : "draft"}
                </Badge>
              </div>
              {p.excerpt && <p className="text-xs text-zinc-500 mt-1 truncate">{p.excerpt}</p>}
              <p className="text-[10px] text-zinc-600 font-mono mt-1">/{p.slug}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <form action={togglePublish}>
                <input type="hidden" name="id" value={p.id} />
                <input type="hidden" name="published" value={String(p.published)} />
                <button type="submit" className="text-xs px-3 py-2 rounded-lg border border-white/10 text-zinc-300 hover:bg-white/5 transition-colors">
                  {p.published ? "Unpublish" : "Publish"}
                </button>
              </form>
              <form action={deletePost}>
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" title="Delete" className="h-8 w-8 rounded-lg flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
