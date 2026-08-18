import type { Metadata } from "next";
import { Faq } from "@/components/landing/Faq";
import { Features } from "@/components/landing/Features";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Roles } from "@/components/landing/Roles";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { JsonLd } from "@/components/JsonLd";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

/** Landing marketing publique ViroTeam. */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Roles />
        <HowItWorks />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
