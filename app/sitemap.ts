import type { MetadataRoute } from "next";

// Public-surface sitemap. Auth-gated routes (/play, /me, /book,
// /tournaments/, /manage/, /platform/, /api/) are excluded — no SEO
// value, may leak slugs, bots shouldn't index session-creation flows.
// Locked at Phase 13 / 13-4 / Batch E (D6.1).

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://app.handibowls.co.za";
  const lastModified = new Date();
  return [
    { url: `${base}/`, lastModified, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/login`, lastModified, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/signup`, lastModified, changeFrequency: "monthly", priority: 0.5 },
  ];
}
