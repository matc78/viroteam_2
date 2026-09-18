import { site } from "@/lib/site";

export const dynamic = "force-static";

const PUBLIC_PATHS: ReadonlyArray<{
  path: string;
  changeFrequency: "weekly" | "yearly";
  priority: string;
}> = [
  { path: "", changeFrequency: "weekly", priority: "1.0" },
  { path: "/legal/cgu", changeFrequency: "yearly", priority: "0.3" },
  { path: "/legal/privacy", changeFrequency: "yearly", priority: "0.3" },
  { path: "/legal/mentions", changeFrequency: "yearly", priority: "0.3" },
];

/** Sitemap XML des pages publiques (route handler stable pour les crawlers). */
export function GET(): Response {
  const lastModified = new Date().toISOString();
  const urls = PUBLIC_PATHS.map(({ path, changeFrequency, priority }) => {
    const loc = `${site.url}${path}`;
    return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastModified}</lastmod>
    <changefreq>${changeFrequency}</changefreq>
    <priority>${priority}</priority>
  </url>`;
  }).join("\n");

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`;

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
