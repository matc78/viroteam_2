import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";
import path from "path";

const nextConfig: NextConfig = {
  // Évite que Turbopack prenne la racine monorepo (package-lock.json parent).
  turbopack: {
    root: path.join(__dirname),
  },
  experimental: {
    // Imports nommés réécrits en imports profonds (moins de JS livré).
    optimizePackageImports: ["framer-motion"],
  },
  // PostHog API utilise des trailing slashes (/e/) — ne pas les retirer.
  skipTrailingSlashRedirect: true,
  // En-têtes de sécurité sur toutes les routes. La CSP se limite aux
  // directives sans risque de casse (pas d'iframe tierce du portail, pas de
  // plugins, `<base>` figée) ; une `script-src` stricte demanderait des nonces
  // et l'inventaire des tiers (Firebase, Stripe, PostHog, Sentry, Maps).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
          },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(self)",
          },
        ],
      },
    ];
  },
  // Fallback local / hors App Hosting. En prod FAH, le Host client n’atteint
  // pas toujours next.config — voir aussi `src/middleware.ts` (X-Forwarded-Host).
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "viroteam.com" }],
        destination: "https://www.viroteam.com/:path*",
        permanent: true,
      },
    ];
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://eu-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://eu-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://eu.i.posthog.com/:path*",
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "viroteam",

  project: "viroteam-portal",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  }
});
