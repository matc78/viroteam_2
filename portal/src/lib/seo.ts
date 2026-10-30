import { site } from "@/lib/site";

/** FAQ landing : source unique pour la page et le JSON-LD. */
export const landingFaq = [
  {
    question: "ViroTeam, c’est quoi ?",
    answer:
      "L’app de gestion des clubs sportifs amateurs. Le bureau configure la saison une fois sur le web ; ensuite, convocations, rappels, présences, annonces et relances de cotisation partent tout seuls. Joueurs, coachs et parents suivent dans l’app.",
  },
  {
    question: "Combien coûte ViroTeam ?",
    answer:
      "Rien pour le club pendant la bêta. Seul le paiement des cotisations par carte, si le club l’active, a un coût : le membre paie les frais bancaires Stripe et 1 € pour ViroTeam, et le club reçoit exactement le montant fixé.",
  },
  {
    question: "Nos données et celles des enfants sont-elles protégées ?",
    answer:
      "Le club fonctionne sur invitation uniquement et chacun ne voit que ce que son rôle permet. Les paiements passent par Stripe : les numéros de carte ne transitent jamais par ViroTeam. La mesure d’audience est soumise à votre accord, et chaque compte peut être supprimé depuis l’app.",
  },
  {
    question: "Comment les membres rejoignent-ils le club ?",
    answer: `Le bureau envoie une invitation ou partage un code. Joueurs, coachs et parents installent l’app (Android ou iPhone) ; le bureau utilise l’espace club sur ${site.url.replace("https://", "")}.`,
  },
  {
    question: "Peut-on suivre plusieurs clubs ou plusieurs enfants ?",
    answer:
      "Oui. Un même compte peut appartenir à plusieurs clubs et un parent peut suivre chacun de ses enfants : planning, réponses aux convocations et cotisations.",
  },
  {
    question: "ViroTeam convient-il à mon sport ?",
    answer:
      "Oui, si votre club a des entraînements, des matchs et des cotisations à gérer. L’USMV Volley-Ball l’utilise déjà chaque semaine, et rien n’est propre au volley : foot, hand, basket, rugby ou tout autre sport collectif amateur.",
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
