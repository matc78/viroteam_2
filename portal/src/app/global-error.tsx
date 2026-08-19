"use client";

import * as Sentry from "@sentry/nextjs";
import Error from "next/error";
import { useEffect } from "react";

export default function GlobalError({ error }: { error: Error }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  
  return (
    <html>
      <body>
        <h2>Une erreur est survenue</h2>
      </body>
    </html>
  );
}
