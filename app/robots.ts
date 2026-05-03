import type { MetadataRoute } from "next";

// Allow marketing landing; disallow auth-gated routes (no value
// indexing, plus avoid bot session-creation traffic). Locked at
// Phase 13 / 13-4 / Batch E (D6.2).

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/"],
        disallow: [
          "/manage/",
          "/platform/",
          "/play",
          "/book",
          "/tournaments/",
          "/me",
          "/api/",
        ],
      },
    ],
    sitemap: "https://app.handibowls.co.za/sitemap.xml",
  };
}
