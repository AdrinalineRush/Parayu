"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

export async function createPost(formData: FormData) {
  const admin = await requireAdmin();
  const title = String(formData.get("title") ?? "").trim();
  const excerpt = String(formData.get("excerpt") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  if (!title) throw new Error("Title required");

  const slug = `${slugify(title)}-${Date.now().toString(36)}`;
  await supabaseAdmin().from("blog_posts").insert({ title, slug, excerpt, body, published: false });
  await logAudit({ actorEmail: admin.email, action: "blog_create", target: slug });
  revalidatePath("/admin/blog");
}

export async function togglePublish(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const next = String(formData.get("published")) !== "true";
  await supabaseAdmin().from("blog_posts").update({ published: next }).eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "blog_publish", target: id, meta: { published: next } });
  revalidatePath("/admin/blog");
}

export async function deletePost(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  await supabaseAdmin().from("blog_posts").delete().eq("id", id);
  await logAudit({ actorEmail: admin.email, action: "blog_delete", target: id });
  revalidatePath("/admin/blog");
}
