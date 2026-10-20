// This file configures the initialization of Sentry on the client.
// The added config here will be used whenever a users loads a page in their browser.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Replay chargé à la demande (CDN Sentry) une fois la page interactive :
  // ~60 Ko gzip de moins dans le bundle initial.
  integrations: [],

  // 10 % des traces en prod : le tracing complet alourdit chaque navigation.
  tracesSampleRate: isProduction ? 0.1 : 1,
  // Enable logs to be sent to Sentry
  enableLogs: true,

  // Define how likely Replay events are sampled.
  // This sets the sample rate to be 10%. You may want this to be 100% while
  // in development and sample at a lower rate in production
  replaysSessionSampleRate: 0.1,

  // Define how likely Replay events are sampled when an error occurs.
  replaysOnErrorSampleRate: 1.0,

  dataCollection: {
    // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
    // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
    // userInfo: false,
    // httpBodies: [],
  },
});

if (typeof window !== "undefined") {
  const addReplay = () => {
    void Sentry.lazyLoadIntegration("replayIntegration")
      .then((replayIntegration) => Sentry.addIntegration(replayIntegration()))
      .catch(() => undefined);
  };
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(addReplay, { timeout: 10_000 });
  } else {
    setTimeout(addReplay, 5_000);
  }
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
