import type { MetadataRoute } from "next";
import { site } from "@/lib/site";

/** robots.txt : indexe le site public, ignore l’espace club. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/home",
        "/members",
        "/planning",
        "/fees",
        "/announcements",
        "/login",
        "/signup",
        "/join",
        "/access-denied",
      ],
    },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
