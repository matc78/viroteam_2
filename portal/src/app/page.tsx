import type { Metadata } from "next";
import { BureauSpace } from "@/components/landing/BureauSpace";
import { Faq } from "@/components/landing/Faq";
import { FinalCta } from "@/components/landing/FinalCta";
import { Hero } from "@/components/landing/Hero";
import { Pricing } from "@/components/landing/Pricing";
import { Roles } from "@/components/landing/Roles";
import { SetAndForget } from "@/components/landing/SetAndForget";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";
import { StatsBand } from "@/components/landing/StatsBand";
import { WeekStory } from "@/components/landing/WeekStory";
import { JsonLd } from "@/components/JsonLd";
import { absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
  alternates: { canonical: absoluteUrl("/") },
};

/**
 * Landing marketing publique : promesse « configurez une fois », preuve par un
 * vrai club, récit d'une semaine, espace bureau, rôles, tarifs, FAQ.
 */
export default function HomePage() {
  return (
    <>
      <JsonLd />
      <SiteHeader />
      <main data-landing>
        <Hero />
        <StatsBand />
        <SetAndForget />
        <WeekStory />
        <BureauSpace />
        <Roles />
        <Pricing />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
