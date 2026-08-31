import { ClubSetupSteps } from "@/lib/clubSetup/constants";

/** Textes d’intro par étape (AuthPageIntro). */
export const ClubSetupStepIntros = [
  {
    eyebrow: "Création de club",
    title: "Avant de commencer",
    lead: "Quelques infos et c'est lancé — on sauvegarde au fur et à mesure.",
  },
  {
    eyebrow: "Création de club",
    title: "Identité du club",
    lead: "",
  },
  {
    eyebrow: "Création de club",
    title: "Vos priorités",
    lead: "Sélectionnez ce qui compte le plus — vous pourrez tout utiliser ensuite.",
  },
  {
    eyebrow: "Création de club",
    title: "Localisation",
    lead: "Siège du club et lieux de pratique.",
  },
  {
    eyebrow: "Création de club",
    title: "Récapitulatif",
    lead: "Tout est prêt — revenez en arrière pour corriger si besoin.",
  },
] as const;

/** Retourne l’intro de l’étape courante. */
export function clubSetupStepIntro(step: number) {
  return ClubSetupStepIntros[ClubSetupSteps.clampIndex(step)];
}
