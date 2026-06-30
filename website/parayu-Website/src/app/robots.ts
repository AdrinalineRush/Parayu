import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Keep private/app areas out of search results.
      disallow: ["/admin", "/dashboard", "/api", "/sign-in", "/sign-up"],
    },
    sitemap: "https://parayu.online/sitemap.xml",
    host: "https://parayu.online",
  };
}
