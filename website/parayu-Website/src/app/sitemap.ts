import type { MetadataRoute } from "next";

const BASE = "https://parayu.online";

// Public marketing routes only — admin/dashboard/auth are intentionally excluded.
const routes: { path: string; priority: number; freq: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "", priority: 1.0, freq: "weekly" },
  { path: "/parayu-vs-wispr-flow", priority: 0.9, freq: "monthly" },
  { path: "/features", priority: 0.9, freq: "monthly" },
  { path: "/pricing", priority: 0.9, freq: "monthly" },
  { path: "/use-cases", priority: 0.8, freq: "monthly" },
  { path: "/use-cases/students", priority: 0.7, freq: "monthly" },
  { path: "/use-cases/developers", priority: 0.7, freq: "monthly" },
  { path: "/use-cases/founders", priority: 0.7, freq: "monthly" },
  { path: "/use-cases/content-creators", priority: 0.7, freq: "monthly" },
  { path: "/commands", priority: 0.7, freq: "monthly" },
  { path: "/integrations", priority: 0.7, freq: "monthly" },
  { path: "/languages", priority: 0.7, freq: "monthly" },
  { path: "/blog", priority: 0.7, freq: "weekly" },
  { path: "/docs", priority: 0.7, freq: "monthly" },
  { path: "/help", priority: 0.6, freq: "monthly" },
  { path: "/resources", priority: 0.6, freq: "monthly" },
  { path: "/about", priority: 0.6, freq: "monthly" },
  { path: "/careers", priority: 0.5, freq: "monthly" },
  { path: "/contact", priority: 0.6, freq: "monthly" },
  { path: "/enterprise", priority: 0.6, freq: "monthly" },
  { path: "/affiliate", priority: 0.5, freq: "monthly" },
  { path: "/media-kit", priority: 0.5, freq: "monthly" },
  { path: "/privacy", priority: 0.4, freq: "yearly" },
  { path: "/terms", priority: 0.4, freq: "yearly" },
  { path: "/trust", priority: 0.5, freq: "monthly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.map((r) => ({
    url: `${BASE}${r.path}`,
    lastModified: now,
    changeFrequency: r.freq,
    priority: r.priority,
  }));
}
