import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** robots.txt : indexe le marketing public, bloque auth / espace club / famille. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/members",
        "/planning",
        "/my-planning",
        "/fees",
        "/announcements",
        "/equipment",
        "/activity",
        "/team",
        "/messages",
        "/settings",
        "/family",
        "/club-setup",
        "/login",
        "/signup",
        "/join",
        "/access-denied",
        "/api/",
        "/ingest",
        "/monitoring",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: "www.viroteam.com",
  };
}
