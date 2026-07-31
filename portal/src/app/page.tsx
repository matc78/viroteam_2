import { FinalCta } from "@/components/landing/FinalCta";
import { Features } from "@/components/landing/Features";
import { Hero } from "@/components/landing/Hero";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { Roles } from "@/components/landing/Roles";
import { SiteFooter } from "@/components/landing/SiteFooter";
import { SiteHeader } from "@/components/landing/SiteHeader";

/** Landing marketing publique ViroTeam. */
export default function HomePage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Roles />
        <HowItWorks />
        <FinalCta />
      </main>
      <SiteFooter />
    </>
  );
}
