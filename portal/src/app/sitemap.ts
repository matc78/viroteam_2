import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** Sitemap des pages publiques à indexer. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.url,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
