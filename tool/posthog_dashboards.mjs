#!/usr/bin/env node
/**
 * Crée les tableaux de bord PostHog décrits dans docs/ANALYTICS.md
 * (Santé, Activation, Rétention, Cotisations, Portail) via l'API privée PostHog.
 *
 * Variables d'environnement :
 *   POSTHOG_PERSONAL_API_KEY  clé personnelle (scopes : dashboard, insight,
 *                             action en écriture ; group en lecture)
 *   POSTHOG_PROJECT_ID        id numérique du projet (dev d'abord, puis prod)
 *   POSTHOG_API_HOST          défaut https://eu.posthog.com
 *
 * Usage :
 *   node tool/posthog_dashboards.mjs --dry-run   # affiche les requêtes
 *   node tool/posthog_dashboards.mjs             # crée ce qui manque
 *   node tool/posthog_dashboards.mjs --only=Portail  # un seul tableau
 *
 * Idempotent par nom : un tableau de bord ou une action déjà présents ne
 * sont pas recréés (supprimer le tableau dans PostHog pour le régénérer).
 */

const DRY_RUN = process.argv.includes("--dry-run");
/** `--only=Portail` : ne traite que le tableau de ce nom. */
const ONLY = process.argv.find((arg) => arg.startsWith("--only="))?.slice("--only=".length);
const API_HOST = (process.env.POSTHOG_API_HOST ?? "https://eu.posthog.com").replace(/\/$/, "");
const API_KEY = process.env.POSTHOG_PERSONAL_API_KEY ?? "";
const PROJECT_ID = process.env.POSTHOG_PROJECT_ID ?? "";

/** Type de groupe PostHog du club (aligné app, portail, Functions). */
const CLUB_GROUP_TYPE = "club";
/** Index utilisé en --dry-run quand l'API n'est pas interrogée. */
const DRY_RUN_GROUP_INDEX = 0;
const MEMBER_JOINED_ACTION = "Membre arrivé dans un club";
const ACTIVATION_MIN_MEMBERS = 5;
const ACTIVE_CLUB_MIN_RSVPS = 3;

if (!DRY_RUN && (!API_KEY || !PROJECT_ID)) {
  console.error("POSTHOG_PERSONAL_API_KEY et POSTHOG_PROJECT_ID sont requis (ou --dry-run).");
  process.exit(1);
}

const projectPath = `/api/projects/${PROJECT_ID || "<project>"}`;

/** Appel API PostHog ; en --dry-run, n'exécute que les lectures simulées. */
async function api(method, path, body) {
  if (DRY_RUN) {
    if (method !== "GET") {
      console.log(`\n${method} ${path}\n${JSON.stringify(body, null, 2)}`);
    }
    return method === "GET" ? { results: [] } : { id: `<${path.split("/").at(-2)}>` };
  }
  const response = await fetch(`${API_HOST}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${await response.text()}`);
  }
  return response.json();
}

/** Toutes les pages d'une liste paginée PostHog. */
async function listAll(path) {
  const items = [];
  let next = path;
  while (next) {
    const page = await api("GET", next);
    items.push(...(page.results ?? page ?? []));
    next = page.next ? new URL(page.next).pathname + new URL(page.next).search : null;
  }
  return items;
}

async function clubGroupIndex() {
  if (DRY_RUN) return DRY_RUN_GROUP_INDEX;
  const groupTypes = await api("GET", `${projectPath}/groups_types/`);
  const club = (Array.isArray(groupTypes) ? groupTypes : groupTypes.results ?? []).find(
    (groupType) => groupType.group_type === CLUB_GROUP_TYPE,
  );
  if (!club) {
    throw new Error(
      `Type de groupe « ${CLUB_GROUP_TYPE} » absent : il apparaît après le premier événement rattaché à un club.`,
    );
  }
  return club.group_type_index;
}

async function ensureMemberJoinedAction() {
  const actions = await listAll(`${projectPath}/actions/?limit=200`);
  const existing = actions.find((action) => action.name === MEMBER_JOINED_ACTION);
  if (existing) return existing.id;
  const created = await api("POST", `${projectPath}/actions/`, {
    name: MEMBER_JOINED_ACTION,
    description: "Arrivée d'un membre : invitation individuelle acceptée ou code d'équipe utilisé.",
    steps: [{ event: "invitation_accepted" }, { event: "join_code_used" }],
  });
  return created.id;
}

const notServer = [{ key: "surface", value: ["server"], operator: "is_not", type: "event" }];
const portalSurface = [{ key: "surface", value: ["portal"], operator: "exact", type: "event" }];
/** Événements serveur issus d'une callable appelée depuis le portail. */
const portalClient = [{ key: "client", value: ["portal"], operator: "exact", type: "event" }];
/** Événements serveur émis par une callable (le client y est connu). */
const PORTAL_CALLABLE_EVENTS = [
  "invitation_sent",
  "invitation_accepted",
  "join_code_used",
  "guardian_linked",
  "rsvp_set",
];
const weekly = { interval: "week", dateRange: { date_from: "-12w" } };

function trends(series, extra = {}) {
  return { kind: "InsightVizNode", source: { kind: "TrendsQuery", series, ...weekly, ...extra } };
}

function sql(query) {
  return { kind: "DataVisualizationNode", source: { kind: "HogQLQuery", query } };
}

/** Définition des tableaux de bord ; [groupIndex] = index du groupe club. */
function dashboards({ groupIndex, memberJoinedActionId }) {
  const club = `$group_${groupIndex}`;
  const byClub = { math: "unique_group", math_group_type_index: groupIndex };
  return [
    {
      name: "Santé",
      description: "Rituel du lundi : utilisateurs actifs, clubs actifs, nouveaux clubs, plateformes.",
      insights: [
        {
          name: "Clubs actifs par semaine (métrique principale)",
          description: `Club ayant créé au moins un événement et reçu au moins ${ACTIVE_CLUB_MIN_RSVPS} réponses dans la semaine.`,
          query: sql(`SELECT semaine, count() AS clubs_actifs
FROM (
  SELECT ${club} AS club_id,
         toStartOfWeek(timestamp, 1) AS semaine,
         countIf(event = 'event_created') AS evenements,
         countIf(event = 'rsvp_set') AS reponses
  FROM events
  WHERE event IN ('event_created', 'rsvp_set')
    AND ${club} != ''
    AND timestamp >= toStartOfWeek(now(), 1) - INTERVAL 12 WEEK
  GROUP BY club_id, semaine
)
WHERE evenements >= 1 AND reponses >= ${ACTIVE_CLUB_MIN_RSVPS}
GROUP BY semaine
ORDER BY semaine`),
        },
        {
          name: "Utilisateurs actifs par semaine",
          description: "Personnes ayant consenti à la mesure (app + portail).",
          query: trends([{ kind: "EventsNode", event: null, name: "All events", math: "dau" }], {
            properties: notServer,
          }),
        },
        {
          name: "Clubs avec de l'activité par semaine",
          description: "Clubs ayant au moins un événement analytics (tous types).",
          query: trends([{ kind: "EventsNode", event: null, name: "All events", ...byClub }]),
        },
        {
          name: "Nouveaux clubs et inscriptions",
          query: trends([
            { kind: "EventsNode", event: "club_created", name: "club_created", math: "total" },
            { kind: "EventsNode", event: "signup_completed", name: "signup_completed", math: "total" },
          ]),
        },
        {
          name: "Répartition app iOS / app Android / portail",
          description: "Utilisateurs actifs uniques par plateforme et par semaine.",
          query: sql(`SELECT toStartOfWeek(timestamp, 1) AS semaine,
       multiIf(properties.surface = 'portal', 'portail',
               properties.$os = 'iOS', 'app iOS',
               properties.$os = 'Android', 'app Android',
               'autre') AS plateforme,
       count(DISTINCT person_id) AS utilisateurs
FROM events
WHERE properties.surface IN ('app', 'portal')
  AND timestamp >= toStartOfWeek(now(), 1) - INTERVAL 12 WEEK
GROUP BY semaine, plateforme
ORDER BY semaine, plateforme`),
        },
      ],
    },
    {
      name: "Activation des clubs",
      description: "Où les clubs abandonnent entre la création et le premier RSVP.",
      insights: [
        {
          name: "Entonnoir d'activation",
          description: `Club créé → 1re invitation → ${ACTIVATION_MIN_MEMBERS} membres ou plus → 1er événement → 1er RSVP (30 jours, par club).`,
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "FunnelsQuery",
              aggregation_group_type_index: groupIndex,
              dateRange: { date_from: "-90d" },
              funnelsFilter: { funnelWindowInterval: 30, funnelWindowIntervalUnit: "day" },
              series: [
                { kind: "EventsNode", event: "club_created", name: "club_created" },
                { kind: "EventsNode", event: "invitation_sent", name: "invitation_sent" },
                {
                  kind: "ActionsNode",
                  id: memberJoinedActionId,
                  name: MEMBER_JOINED_ACTION,
                  properties: [
                    { key: "member_count", value: ACTIVATION_MIN_MEMBERS, operator: "gte", type: "event" },
                  ],
                },
                { kind: "EventsNode", event: "event_created", name: "event_created" },
                { kind: "EventsNode", event: "rsvp_set", name: "rsvp_set" },
              ],
            },
          },
        },
      ],
    },
    {
      name: "Rétention",
      description: "Par semaine d'arrivée, la part des personnes qui reviennent.",
      insights: [
        {
          name: "Rétention hebdomadaire",
          description: "Cohorte = première identification (après consentement) ; retour = n'importe quel événement.",
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "RetentionQuery",
              properties: notServer,
              dateRange: { date_from: "-8w" },
              retentionFilter: {
                period: "Week",
                totalIntervals: 8,
                retentionType: "retention_first_time",
                targetEntity: { id: "$identify", name: "$identify", type: "events" },
                returningEntity: { id: null, name: "All events", type: "events" },
              },
            },
          },
        },
      ],
    },
    {
      name: "Cotisations",
      description: "Entonnoir de paiement et montants encaissés.",
      insights: [
        {
          name: "Entonnoir de paiement",
          description: "Démarré → confirmé côté client → crédité par le webhook (par club, 1 jour).",
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "FunnelsQuery",
              aggregation_group_type_index: groupIndex,
              dateRange: { date_from: "-90d" },
              funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: "day" },
              series: [
                { kind: "EventsNode", event: "fee_payment_started", name: "fee_payment_started" },
                { kind: "EventsNode", event: "fee_payment_submitted", name: "fee_payment_submitted" },
                { kind: "EventsNode", event: "fee_payment_succeeded", name: "fee_payment_succeeded" },
              ],
            },
          },
        },
        {
          name: "Montant encaissé par semaine (centimes)",
          query: trends([
            {
              kind: "EventsNode",
              event: "fee_payment_succeeded",
              name: "fee_payment_succeeded",
              math: "sum",
              math_property: "amount_cents",
            },
          ]),
        },
      ],
    },
    {
      name: "Portail",
      description: "Usage du portail web seul (surface = portal, client = portal pour les actions serveur).",
      insights: [
        {
          name: "Utilisateurs actifs du portail par semaine",
          description: "Personnes ayant consenti, au moins un événement sur le portail.",
          query: trends([{ kind: "EventsNode", event: null, name: "All events", math: "dau" }], {
            properties: portalSurface,
          }),
        },
        {
          name: "Clubs actifs sur le portail par semaine",
          query: trends([{ kind: "EventsNode", event: null, name: "All events", ...byClub }], {
            properties: portalSurface,
          }),
        },
        {
          name: "Pages vues par semaine",
          query: trends([{ kind: "EventsNode", event: "$pageview", name: "$pageview", math: "total" }], {
            properties: portalSurface,
          }),
        },
        {
          name: "Pages les plus vues (30 jours)",
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "TrendsQuery",
              series: [{ kind: "EventsNode", event: "$pageview", name: "$pageview", math: "total" }],
              properties: portalSurface,
              dateRange: { date_from: "-30d" },
              breakdownFilter: { breakdown: "$pathname", breakdown_type: "event", breakdown_limit: 25 },
              trendsFilter: { display: "ActionsTable" },
            },
          },
        },
        {
          name: "Actions faites depuis le portail",
          description:
            "Événements serveur dont la callable a été appelée depuis le portail. Les créations d'événements et les RSVP directs passent par des triggers Firestore et ne sont pas attribuables.",
          query: trends(
            PORTAL_CALLABLE_EVENTS.map((event) => ({ kind: "EventsNode", event, name: event, math: "total" })),
            { properties: portalClient },
          ),
        },
        {
          name: "Part du portail dans les actions serveur (12 semaines)",
          description: "Événements émis par une callable, répartis par client appelant (app / portal).",
          query: sql(`SELECT event,
       countIf(properties.client = 'portal') AS portail,
       countIf(properties.client = 'app') AS app,
       round(100 * portail / count(), 1) AS part_portail_pct
FROM events
WHERE properties.surface = 'server'
  AND properties.client IN ('app', 'portal')
  AND timestamp >= toStartOfWeek(now(), 1) - INTERVAL 12 WEEK
GROUP BY event
ORDER BY portail DESC`),
        },
        {
          name: "Création de club sur le portail",
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "FunnelsQuery",
              properties: portalSurface,
              dateRange: { date_from: "-90d" },
              funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: "day" },
              series: [
                { kind: "EventsNode", event: "club_setup_started", name: "club_setup_started" },
                { kind: "EventsNode", event: "club_setup_completed", name: "club_setup_completed" },
              ],
            },
          },
        },
        {
          name: "Paiement des cotisations sur le portail",
          query: {
            kind: "InsightVizNode",
            source: {
              kind: "FunnelsQuery",
              properties: portalSurface,
              dateRange: { date_from: "-90d" },
              funnelsFilter: { funnelWindowInterval: 1, funnelWindowIntervalUnit: "day" },
              series: [
                { kind: "EventsNode", event: "fee_payment_started", name: "fee_payment_started" },
                { kind: "EventsNode", event: "fee_payment_submitted", name: "fee_payment_submitted" },
              ],
            },
          },
        },
      ],
    },
  ];
}

async function main() {
  const groupIndex = await clubGroupIndex();
  const memberJoinedActionId = await ensureMemberJoinedAction();
  const existing = await listAll(`${projectPath}/dashboards/?limit=200`);
  const existingNames = new Set(existing.filter((d) => !d.deleted).map((d) => d.name));

  for (const dashboard of dashboards({ groupIndex, memberJoinedActionId })) {
    if (ONLY && dashboard.name !== ONLY) continue;
    if (existingNames.has(dashboard.name)) {
      console.log(`= ${dashboard.name} : déjà présent, ignoré`);
      continue;
    }
    const created = await api("POST", `${projectPath}/dashboards/`, {
      name: dashboard.name,
      description: dashboard.description,
    });
    for (const insight of dashboard.insights) {
      try {
        await api("POST", `${projectPath}/insights/`, {
          name: insight.name,
          description: insight.description ?? "",
          query: insight.query,
          dashboards: [created.id],
        });
        console.log(`+ ${dashboard.name} › ${insight.name}`);
      } catch (error) {
        console.error(`! ${dashboard.name} › ${insight.name} : ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
