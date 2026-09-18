import { site } from "@/lib/site";

/** FAQ landing : source unique pour la page et le JSON-LD. */
export const landingFaq = [
  {
    question: "ViroTeam, c’est quoi ?",
    answer:
      "ViroTeam est l’application de gestion pour clubs sportifs amateurs. Elle centralise planning, convocations, cotisations, membres et équipes. Le bureau pilote depuis le web ; joueurs, coachs et parents suivent dans l’app. Un compte peut rejoindre plusieurs clubs (multiclub).",
  },
  {
    question: "Quelle app pour gérer un club sportif amateur ?",
    answer:
      "ViroTeam est conçue pour ça : planning des entraînements et matchs, convocations avec réponses, suivi des cotisations, licences et composition des équipes — pour le bureau, les coachs, les joueurs et les parents.",
  },
  {
    question: "Comment organiser le planning du club ?",
    answer:
      "Le coach ou l’admin crée séances et matchs, filtre par équipe ou coach, et suit les réponses aux convocations. Membres et parents voient le même calendrier dans l’application mobile, sans chercher l’info éparpillée.",
  },
  {
    question: "Comment gérer les membres et les équipes ?",
    answer:
      "Le bureau suit licences et invitations, filtre l’effectif, et compose les équipes par catégorie avec joueurs et coachs. Parents et membres rejoignent le club sur invitation uniquement.",
  },
  {
    question: "Comment suivre les cotisations du club ?",
    answer:
      "Le bureau configure la saison et les tarifs, puis suit qui a payé et les restes dus. Un rappel par e-mail groupé est possible ; parents et membres voient montant et échéance dans l’app. Le paiement en ligne (carte) peut être activé par le club.",
  },
  {
    question: "Peut-on gérer plusieurs clubs avec le même compte ?",
    answer:
      "Oui. ViroTeam est multiclub : avec un même compte, vous pouvez appartenir à plusieurs clubs et basculer facilement entre eux.",
  },
  {
    question: "ViroTeam convient-il au volleyball et aux autres sports ?",
    answer:
      "Oui. ViroTeam convient aux clubs de volleyball et plus largement aux clubs sportifs amateurs qui ont besoin d’organiser planning, convocations, équipes et cotisations — bureau, coachs, joueurs et parents.",
  },
  {
    question: "Sur quels appareils fonctionne ViroTeam ?",
    answer: `L’app Android est disponible sur Google Play. L’espace club (bureau) s’utilise sur le web via ${site.url.replace("https://", "")}. L’App Store arrive bientôt.`,
  },
] as const;

/** Blocs JSON-LD FAQ dérivés de la FAQ landing. */
export function faqJsonLdEntities() {
  return landingFaq.map((item) => ({
    "@type": "Question" as const,
    name: item.question,
    acceptedAnswer: {
      "@type": "Answer" as const,
      text: item.answer,
    },
  }));
}
