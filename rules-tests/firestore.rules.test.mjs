// Tests des règles Firestore ViroTeam v2 (émulateur).
// Lancer : `cd rules-tests && npm test` (firebase-tools + Java requis).
//
// Chaque test rejoue une faille corrigée dans le lot 1 sécurité (2 sept. 2026),
// le lot 2 chat / parents (28 sept. 2026), la refonte « droits purs »
// (nov. 2026 : `members/{uid}.permissions` + relation coach `coachTeamIds`),
// ou un parcours nominal qui doit continuer à fonctionner.

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from "@firebase/rules-unit-testing";
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  writeBatch,
  serverTimestamp,
  deleteField,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from "firebase/firestore";

const PROJECT_ID = "viroteam-rules-test";
const CLUB = "club1";
const OTHER_CLUB = "club2";

/** Utilisateurs de test. */
const ADMIN = { uid: "admin1", email: "admin@club.fr" };
const COACH = { uid: "coach1", email: "coach@club.fr" };
const PLAYER = { uid: "player1", email: "player@club.fr" };
const PARENT = { uid: "parent1", email: "parent@club.fr" };
const STRANGER = { uid: "stranger1", email: "stranger@else.fr" };
const INVITEE = { uid: "invitee1", email: "invitee@club.fr" };
/** Joueur d'une autre équipe (teamB) : invisible pour le parent de teamA. */
const OTHER_PLAYER = { uid: "player2", email: "player2@club.fr" };
/** Responsable cotisations : droits `manageFees` + `viewFees`, ni coach ni admin. */
const TREASURER = { uid: "treasurer1", email: "tresor@club.fr" };

/** Conversations chat (créées par les Cloud Functions en réel). */
const CONV_TEAM = "convTeam"; // équipe A, open : admin + coach + joueur
const CONV_CLUB = "convClub"; // club, admins_only : tout le monde
const CONV_DM = "convDm"; // DM coach ↔ joueur

const BUCKET = "https://firebasestorage.googleapis.com/v0/b/viroteam-75303.appspot.com/o";
function chatMediaUrl(conversationId, uid, fileName) {
  return `${BUCKET}/clubs%2F${CLUB}%2Fchat%2F${conversationId}%2F${uid}%2F${fileName}?alt=media&token=abc`;
}
function chatMediaPath(conversationId, uid, fileName) {
  return `clubs/${CLUB}/chat/${conversationId}/${uid}/${fileName}`;
}
/** Expiration d'invitation telle que posée par l'app / le portail (+7 jours). */
function inviteExpiry(days = 7) {
  return Timestamp.fromDate(new Date(Date.now() + days * 86400000));
}
function textMessage(sender, extra = {}) {
  return {
    type: "text",
    text: "Bonjour",
    senderUid: sender.uid,
    createdAt: serverTimestamp(),
    reactions: {},
    ...extra,
  };
}

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8"),
    },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    // Club avec un admin, un coach, un joueur, une fiche pré-créée invitée,
    // un parent lié au joueur (équipe teamA). Un second club pour les fuites.
    await setDoc(doc(db, `clubs/${CLUB}`), {
      name: "Club 1",
      sport: "Judo",
      adminIds: [ADMIN.uid],
      memberCount: 3,
    });
    await setDoc(doc(db, `clubs/${OTHER_CLUB}`), {
      name: "Club 2",
      sport: "Football",
      adminIds: ["someoneElse"],
      memberCount: 1,
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${ADMIN.uid}`), {
      accountUid: ADMIN.uid,
      permissions: ["admin"],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${COACH.uid}`), {
      accountUid: COACH.uid,
      permissions: ["viewActivity"],
      coachTeamIds: ["teamA"],
      status: "active",
      teamIds: ["teamA"],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${TREASURER.uid}`), {
      accountUid: TREASURER.uid,
      permissions: ["manageFees", "viewFees"],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${PLAYER.uid}`), {
      accountUid: PLAYER.uid,
      permissions: [],
      coachTeamIds: [],
      status: "active",
      teamIds: ["teamA"],
      firstName: "Paul",
      lastName: "Joueur",
      snapshot: { displayName: "Paul Joueur", email: PLAYER.email },
    });
    // Fiche pré-créée (enfant sans compte) + invitation en attente.
    await setDoc(doc(db, `clubs/${CLUB}/members/precreated1`), {
      permissions: [],
      coachTeamIds: [],
      status: "active",
      teamIds: ["teamA"],
      firstName: "Inès",
      lastName: "Invitée",
      activeInvitationId: "inv1",
      snapshot: { displayName: "Inès Invitée", email: INVITEE.email },
    });
    await setDoc(doc(db, `clubs/${CLUB}/invitations/inv1`), {
      code: "ABC123",
      status: "pending",
      type: "member",
      memberId: "precreated1",
      email: INVITEE.email,
    });
    // Parent actif du joueur, index côté user.
    await setDoc(doc(db, `clubs/${CLUB}/members/${PLAYER.uid}/guardians/${PARENT.uid}`), {
      status: "active",
    });
    await setDoc(doc(db, `users/${PARENT.uid}`), {
      email: PARENT.email,
      parentClubIds: [CLUB],
      parentTeamIds: ["teamA"],
      parentLinks: [{ clubId: CLUB, memberId: PLAYER.uid, status: "active" }],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${OTHER_PLAYER.uid}`), {
      accountUid: OTHER_PLAYER.uid,
      permissions: [],
      coachTeamIds: [],
      status: "active",
      teamIds: ["teamB"],
      firstName: "Léa",
      lastName: "Autre",
    });
    // `memberClubIds` : maintenu par la Function `onUserWrittenSyncClubIds`.
    for (const u of [ADMIN, COACH, PLAYER, OTHER_PLAYER, TREASURER]) {
      await setDoc(doc(db, `users/${u.uid}`), {
        email: u.email,
        emailNorm: u.email,
        memberClubIds: [CLUB],
      });
    }
    for (const u of [STRANGER, INVITEE]) {
      await setDoc(doc(db, `users/${u.uid}`), { email: u.email, emailNorm: u.email });
    }
    // Conversations système (participants maintenus par les Cloud Functions).
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_TEAM}`), {
      type: "team",
      systemKey: "team:teamA",
      teamId: "teamA",
      title: "Équipe A",
      participantUids: [ADMIN.uid, COACH.uid, PLAYER.uid],
      writePolicy: "open",
    });
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_CLUB}`), {
      type: "club",
      systemKey: "club",
      title: "Club 1",
      participantUids: [ADMIN.uid, COACH.uid, PLAYER.uid, OTHER_PLAYER.uid],
      writePolicy: "admins_only",
    });
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_DM}`), {
      type: "dm",
      title: "Coach",
      participantUids: [COACH.uid, PLAYER.uid],
      writePolicy: "open",
    });
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/msgOld`), {
      type: "text",
      text: "Ancien",
      senderUid: COACH.uid,
      createdAt: Timestamp.now(),
      reactions: {},
    });
    // Équipes et contenus.
    await setDoc(doc(db, `clubs/${CLUB}/teams/teamA`), {
      name: "Équipe A",
      playerIds: [PLAYER.uid],
      coachIds: [COACH.uid],
    });
    await setDoc(doc(db, `clubs/${CLUB}/teams/teamB`), { name: "Équipe B", playerIds: [] });
    await setDoc(doc(db, `clubs/${CLUB}/events/evA`), {
      title: "Entraînement A",
      teamIds: ["teamA"],
      teamMemberIds: [PLAYER.uid],
    });
    await setDoc(doc(db, `clubs/${CLUB}/events/evB`), { title: "Match B", teamIds: ["teamB"] });
    await setDoc(doc(db, `clubs/${CLUB}/announcements/annAll`), {
      title: "Pour tous",
      targetType: "Tous les membres",
      targetIds: [],
    });
    await setDoc(doc(db, `clubs/${CLUB}/announcements/annA`), {
      title: "Équipe A",
      targetType: "Équipes",
      targetIds: ["teamA"],
    });
    await setDoc(doc(db, `clubs/${CLUB}/announcements/annB`), {
      title: "Équipe B",
      targetType: "Équipes",
      targetIds: ["teamB"],
    });
  });
});

function as(user) {
  return env.authenticatedContext(user.uid, { email: user.email }).firestore();
}
function anonymous() {
  return env.unauthenticatedContext().firestore();
}

// ————————————————————————————————————————————————————————————————
// Faille 1 : auto-promotion admin par création de sa propre fiche
// ————————————————————————————————————————————————————————————————

test("un compte connecté ne peut pas créer sa fiche admin dans un club existant", async () => {
  await assertFails(
    setDoc(doc(as(STRANGER), `clubs/${CLUB}/members/${STRANGER.uid}`), {
      memberId: STRANGER.uid,
      accountUid: STRANGER.uid,
      permissions: ["admin"],
      status: "active",
    }),
  );
});

test("un compte connecté ne peut pas créer sa fiche joueur dans un club où il n'est pas invité", async () => {
  await assertFails(
    setDoc(doc(as(STRANGER), `clubs/${CLUB}/members/${STRANGER.uid}`), {
      memberId: STRANGER.uid,
      status: "active",
    }),
  );
});

test("le fondateur ne crée plus son club côté client (callable createClub)", async () => {
  const db = as(STRANGER);
  const batch = writeBatch(db);
  batch.set(doc(db, "clubs/newClubBatch"), {
    name: "Nouveau batch",
    sport: "Judo",
    adminIds: [STRANGER.uid],
    memberCount: 1,
  });
  batch.set(doc(db, `clubs/newClubBatch/members/${STRANGER.uid}`), {
    memberId: STRANGER.uid,
    accountUid: STRANGER.uid,
    permissions: ["admin"],
    status: "active",
  });
  await assertFails(batch.commit());
});

// ————————————————————————————————————————————————————————————————
// Faille 2 : un membre écrit son propre rôle (aujourd'hui : ses droits)
// ————————————————————————————————————————————————————————————————

test("un joueur ne peut pas se donner le droit admin", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { permissions: ["admin"] }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { role: "admin" }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { coachTeamIds: ["teamA"] }),
  );
});

test("un joueur ne peut pas changer ses équipes ni son statut", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { teamIds: ["teamB"] }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { status: "banned" }),
  );
});

test("un joueur met à jour son profil affiché", async () => {
  await assertSucceeds(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), {
      firstName: "Pablo",
      snapshot: { displayName: "Pablo Joueur", email: PLAYER.email },
      dismissedAnnouncementIds: ["annAll"],
    }),
  );
});

test("un membre ne peut pas s'approprier une fiche pré-créée (accountUid)", async () => {
  await assertFails(
    updateDoc(doc(as(STRANGER), `clubs/${CLUB}/members/precreated1`), {
      accountUid: STRANGER.uid,
    }),
  );
});

test("le client ne supprime pas une fiche membre (callable removeMember)", async () => {
  await assertFails(deleteDoc(doc(as(ADMIN), `clubs/${CLUB}/members/${PLAYER.uid}`)));
});

// ————————————————————————————————————————————————————————————————
// Faille 3 : lecture / énumération des invitations
// ————————————————————————————————————————————————————————————————

test("une invitation en attente n'est pas lisible sans authentification", async () => {
  await assertFails(getDoc(doc(anonymous(), `clubs/${CLUB}/invitations/inv1`)));
});

test("un compte connecté d'un autre club ne lit pas les invitations", async () => {
  await assertFails(getDoc(doc(as(STRANGER), `clubs/${CLUB}/invitations/inv1`)));
});

test("la recherche par code en collection group est refusée (passer par la callable)", async () => {
  const q = query(
    collectionGroup(as(STRANGER), "invitations"),
    where("code", "==", "ABC123"),
    where("status", "==", "pending"),
  );
  await assertFails(getDocs(q));
});

test("l'invité lit et liste les invitations adressées à son e-mail", async () => {
  await assertSucceeds(getDoc(doc(as(INVITEE), `clubs/${CLUB}/invitations/inv1`)));
  const q = query(
    collectionGroup(as(INVITEE), "invitations"),
    where("email", "==", INVITEE.email),
    where("status", "==", "pending"),
  );
  const snap = await assertSucceeds(getDocs(q));
  assert.equal(snap.size, 1);
});

test("un compte ne liste pas les invitations d'un autre e-mail", async () => {
  const q = query(
    collectionGroup(as(STRANGER), "invitations"),
    where("email", "==", INVITEE.email),
  );
  await assertFails(getDocs(q));
});

test("l'admin du club lit ses invitations", async () => {
  await assertSucceeds(getDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/inv1`)));
  await assertSucceeds(getDocs(collection(as(ADMIN), `clubs/${CLUB}/invitations`)));
});

test("le joueur lit les invitations parent de sa propre fiche", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/invitations/invGuardianOwn`), {
      code: "PAR456",
      status: "pending",
      type: "guardian",
      memberId: PLAYER.uid,
      email: "parent-of-player@club.fr",
      clubId: CLUB,
    });
  });
  await assertSucceeds(
    getDoc(doc(as(PLAYER), `clubs/${CLUB}/invitations/invGuardianOwn`)),
  );
  const q = query(
    collection(as(PLAYER), `clubs/${CLUB}/invitations`),
    where("memberId", "==", PLAYER.uid),
    where("status", "==", "pending"),
  );
  const snap = await assertSucceeds(getDocs(q));
  assert.equal(snap.size, 1);
});

test("le joueur ne lit pas les invitations d'une autre fiche", async () => {
  await assertFails(getDoc(doc(as(PLAYER), `clubs/${CLUB}/invitations/inv1`)));
});

test("l'invité décline son invitation mais ne peut pas l'accepter lui-même", async () => {
  await assertFails(
    updateDoc(doc(as(INVITEE), `clubs/${CLUB}/invitations/inv1`), { status: "accepted" }),
  );
  await assertSucceeds(
    updateDoc(doc(as(INVITEE), `clubs/${CLUB}/invitations/inv1`), { status: "declined" }),
  );
});

test("un tiers ne peut pas passer une invitation à accepted", async () => {
  await assertFails(
    updateDoc(doc(as(STRANGER), `clubs/${CLUB}/invitations/inv1`), {
      status: "accepted",
      acceptedBy: STRANGER.uid,
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Création d'invitation : e-mail obligatoire, pas d'admin par un coach
// ————————————————————————————————————————————————————————————————

test("un coach invite un joueur avec e-mail", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), `clubs/${CLUB}/invitations/new1`), {
      code: "NEW111",
      status: "pending",
      type: "member",
      memberId: "precreated1",
      email: "nouveau@club.fr",
      expiresAt: inviteExpiry(),
    }),
  );
});

test("une invitation sans e-mail est refusée", async () => {
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new2`), {
      code: "NEW222",
      status: "pending",
      type: "member",
    }),
  );
});

test("une invitation ne porte ni rôle ni droit, même créée par un admin", async () => {
  for (const actor of [COACH, ADMIN]) {
    await assertFails(
      setDoc(doc(as(actor), `clubs/${CLUB}/invitations/new3-${actor.uid}`), {
        code: "NEW333",
        status: "pending",
        role: "admin",
        type: "member",
        email: "boss@club.fr",
      }),
    );
    await assertFails(
      setDoc(doc(as(actor), `clubs/${CLUB}/invitations/new4-${actor.uid}`), {
        code: "NEW444",
        status: "pending",
        permissions: ["admin"],
        type: "member",
        email: "boss@club.fr",
      }),
    );
  }
});

test("les invitations parent (guardian) ne se créent pas côté client", async () => {
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new5`), {
      code: "GRD555",
      status: "pending",
      type: "guardian",
      email: "papa@club.fr",
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Lot 3 : escalade coach → admin (fiche pré-créée, invitation modifiée)
// ————————————————————————————————————————————————————————————————

/** Fiche pré-créée telle qu'écrite par l'app et le portail. */
function preCreatedMember(extra = {}) {
  return {
    status: "active",
    firstName: "Nina",
    lastName: "Nouvelle",
    snapshot: { displayName: "Nina Nouvelle", email: "nina@club.fr" },
    activeInvitationId: "invNina",
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    ...extra,
  };
}

test("un coach pré-crée une fiche sans droit", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), `clubs/${CLUB}/members/pre2`), preCreatedMember()),
  );
});

test("une fiche pré-créée ne porte ni droit, ni relation coach, ni rôle, même par un admin", async () => {
  for (const actor of [COACH, ADMIN]) {
    for (const extra of [
      { permissions: ["admin"] },
      { permissions: [] },
      { coachTeamIds: ["teamA"] },
      { role: "admin" },
    ]) {
      const id = `pre-${actor.uid}-${Object.keys(extra)[0]}`;
      await assertFails(
        setDoc(doc(as(actor), `clubs/${CLUB}/members/${id}`), preCreatedMember(extra)),
      );
    }
  }
});

test("un coach ne rend pas admin un compte tiers via members/{uid}", async () => {
  await assertFails(
    setDoc(
      doc(as(COACH), `clubs/${CLUB}/members/${STRANGER.uid}`),
      preCreatedMember({ permissions: ["admin"] }),
    ),
  );
  // Le compte tiers ne gagne aucun droit sur le club.
  await assertFails(
    updateDoc(doc(as(STRANGER), `clubs/${CLUB}`), { name: "Pris" }),
  );
});

test("une fiche pré-créée ne porte ni compte lié, ni équipes, ni champ v1", async () => {
  for (const extra of [
    { accountUid: STRANGER.uid },
    { userId: STRANGER.uid },
    { memberId: "pre6" },
    { teamIds: [] },
    { teamIds: ["teamA"] },
  ]) {
    await assertFails(
      setDoc(doc(as(ADMIN), `clubs/${CLUB}/members/pre6`), preCreatedMember(extra)),
    );
  }
  // Sans ces champs : l'ajout de membre passe (bug bloquant de la refonte).
  await assertSucceeds(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/members/pre6`), preCreatedMember()),
  );
});

test("une invitation ne reçoit ni rôle ni droit, même d'un admin", async () => {
  for (const actor of [COACH, ADMIN]) {
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/invitations/inv1`), { role: "admin" }),
    );
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/invitations/inv1`), { permissions: ["admin"] }),
    );
  }
});

test("un coach corrige l'e-mail, prolonge ou expire une invitation joueur", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/invitations/inv1`), {
      email: "ines@club.fr",
      expiresAt: Timestamp.fromDate(new Date(Date.now() + 7 * 86400000)),
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/invitations/inv1`), {
      status: "expired",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("les invitations parent ne se modifient pas côté client", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/invitations/invGuardian`), {
      code: "GRD777",
      status: "pending",
      type: "guardian",
      memberId: PLAYER.uid,
      email: "maman@club.fr",
    });
  });
  for (const actor of [COACH, ADMIN]) {
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/invitations/invGuardian`), {
        email: actor.email,
      }),
    );
  }
});

// ————————————————————————————————————————————————————————————————
// Fiches pré-créées et club : plus de lecture publique
// ————————————————————————————————————————————————————————————————

test("une fiche pré-créée n'est plus lisible sans authentification ni par un tiers", async () => {
  await assertFails(getDoc(doc(anonymous(), `clubs/${CLUB}/members/precreated1`)));
  await assertFails(getDoc(doc(as(STRANGER), `clubs/${CLUB}/members/precreated1`)));
});

test("le document club n'est plus lisible sans authentification", async () => {
  await assertFails(getDoc(doc(anonymous(), `clubs/${CLUB}`)));
  await assertSucceeds(getDoc(doc(as(STRANGER), `clubs/${CLUB}`)));
});

test("adminIds n'est pas modifiable côté client, même par un admin", async () => {
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { adminIds: [ADMIN.uid, PLAYER.uid] }),
  );
  await assertSucceeds(updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { name: "Club 1 bis" }));
});

test("un coach qui pré-crée une fiche incrémente le compteur du club", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}`), { memberCount: 4 }),
  );
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}`), { name: "Piraté" }));
});

// ————————————————————————————————————————————————————————————————
// users : index parent réservés au serveur, pas de suppression client
// ————————————————————————————————————————————————————————————————

test("un utilisateur ne modifie pas ses index parent ni ne supprime son doc", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), { parentTeamIds: ["teamA"] }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), { parentClubIds: [CLUB] }),
  );
  await assertFails(deleteDoc(doc(as(PLAYER), `users/${PLAYER.uid}`)));
  await assertSucceeds(updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), { displayName: "Paul" }));
});

test("un utilisateur ne modifie pas sa trace legal (CGU) après création", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), {
      legal: { termsVersion: "2099-01", termsAcceptedAt: new Date() },
    }),
  );
});

test("un utilisateur ne s'accorde pas flags.chatMessaging", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), {
      flags: { chatMessaging: true },
    }),
  );
  await assertFails(
    setDoc(doc(as({ uid: "nouveau2", email: "n2@x.fr" }), "users/nouveau2"), {
      email: "n2@x.fr",
      flags: { chatMessaging: true },
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Parents : uniquement l'équipe de l'enfant
// ————————————————————————————————————————————————————————————————

test("un parent lit l'équipe de son enfant, pas les autres", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/teams/teamA`)));
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/teams/teamB`)));
});

test("un parent lit un événement de l'équipe de son enfant, pas d'une autre équipe", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/events/evA`)));
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/events/evB`)));
});

test("un parent liste les événements filtrés sur l'équipe de son enfant", async () => {
  const ok = query(
    collection(as(PARENT), `clubs/${CLUB}/events`),
    where("teamIds", "array-contains", "teamA"),
  );
  const snap = await assertSucceeds(getDocs(ok));
  assert.equal(snap.size, 1);
});

test("un parent liste une période (semaine / mois) sur l'équipe de son enfant", async () => {
  const period = query(
    collection(as(PARENT), `clubs/${CLUB}/events`),
    where("teamIds", "array-contains", "teamA"),
    where("date", ">=", Timestamp.fromDate(new Date("2026-11-01"))),
    where("date", "<", Timestamp.fromDate(new Date("2026-12-01"))),
  );
  await assertSucceeds(getDocs(period));
});

test("un parent ne liste pas tous les événements du club", async () => {
  await assertFails(getDocs(collection(as(PARENT), `clubs/${CLUB}/events`)));
});

test("un parent lit les annonces du club entier et de l'équipe de son enfant, pas des autres", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/announcements/annAll`)));
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/announcements/annA`)));
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/announcements/annB`)));
});

test("un parent liste les annonces par requête ciblée", async () => {
  const all = query(
    collection(as(PARENT), `clubs/${CLUB}/announcements`),
    where("targetType", "==", "Tous les membres"),
  );
  await assertSucceeds(getDocs(all));
  const team = query(
    collection(as(PARENT), `clubs/${CLUB}/announcements`),
    where("targetType", "==", "Équipes"),
    where("targetIds", "array-contains", "teamA"),
  );
  await assertSucceeds(getDocs(team));
});

test("un parent lit la fiche de son enfant, pas celle d'un membre hors de ses équipes", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${PLAYER.uid}`)));
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${OTHER_PLAYER.uid}`)));
});


test("un parent liste les annonces avec les requêtes exactes du portail (in / array-contains-any)", async () => {
  const all = query(
    collection(as(PARENT), `clubs/${CLUB}/announcements`),
    where("targetType", "in", ["Tous les membres", "all"]),
  );
  await assertSucceeds(getDocs(all));
  const teams = query(
    collection(as(PARENT), `clubs/${CLUB}/announcements`),
    where("targetType", "==", "Équipes"),
    where("targetIds", "array-contains-any", ["teamA"]),
  );
  const snap = await assertSucceeds(getDocs(teams));
  assert.equal(snap.size, 1);
  const leak = query(
    collection(as(PARENT), `clubs/${CLUB}/announcements`),
    where("targetType", "==", "Équipes"),
    where("targetIds", "array-contains-any", ["teamA", "teamB"]),
  );
  await assertFails(getDocs(leak));
});

test("un parent liste les événements d'une équipe qui n'est pas celle de son enfant : refusé", async () => {
  const q = query(
    collection(as(PARENT), `clubs/${CLUB}/events`),
    where("teamIds", "array-contains", "teamB"),
  );
  await assertFails(getDocs(q));
});

// ————————————————————————————————————————————————————————————————
// Parcours nominaux membres (non-régression)
// ————————————————————————————————————————————————————————————————

test("un membre lit les équipes, événements et annonces de son club", async () => {
  await assertSucceeds(getDocs(collection(as(PLAYER), `clubs/${CLUB}/events`)));
  await assertSucceeds(getDocs(collection(as(PLAYER), `clubs/${CLUB}/teams`)));
  await assertSucceeds(getDocs(collection(as(PLAYER), `clubs/${CLUB}/announcements`)));
  await assertSucceeds(getDocs(collection(as(PLAYER), `clubs/${CLUB}/members`)));
});

test("un membre ne lit rien d'un club où il n'est pas", async () => {
  await assertFails(getDocs(collection(as(PLAYER), `clubs/${OTHER_CLUB}/events`)));
  await assertFails(getDocs(collection(as(PLAYER), `clubs/${OTHER_CLUB}/members`)));
});

test("un membre répond présent uniquement pour lui-même", async () => {
  await assertSucceeds(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "yes",
      [`rsvpUpdatedAt.${PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "no",
      [`rsvpUpdatedAt.${PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${COACH.uid}`]: "yes",
    }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "maybe",
      [`rsvpUpdatedAt.${COACH.uid}`]: serverTimestamp(),
    }),
  );
});

test("un coach ne peut pas patcher le RSVP d'un joueur côté client", async () => {
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "yes",
      [`rsvpUpdatedAt.${PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  // Le coach peut toujours répondre pour lui-même.
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${COACH.uid}`]: "yes",
      [`rsvpUpdatedAt.${COACH.uid}`]: serverTimestamp(),
    }),
  );
});

test("fiche re-clée sur l'uid : RSVP sous sa seule clé, plus sous l'ancien memberId", async () => {
  const linkedUid = "linkedPlayer1";
  const formerMemberId = "mem-pre-linked";
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `users/${linkedUid}`), {
      email: "linked@club.fr",
      emailNorm: "linked@club.fr",
      memberClubIds: [CLUB],
    });
    // Une seule clé membre : la fiche liée vit à members/{uid}.
    await setDoc(doc(db, `clubs/${CLUB}/members/${linkedUid}`), {
      accountUid: linkedUid,
      formerMemberIds: [formerMemberId],
      permissions: [],
      coachTeamIds: [],
      status: "active",
      teamIds: ["teamA"],
    });
    await setDoc(doc(db, `clubs/${CLUB}/events/evLinked`), {
      title: "Entraînement lié",
      teamIds: ["teamA"],
      teamMemberIds: [linkedUid],
      rsvp: { [linkedUid]: "yes" },
    });
  });

  const asLinked = () => env.authenticatedContext(linkedUid).firestore();
  const eventPath = `clubs/${CLUB}/events/evLinked`;

  await assertSucceeds(
    updateDoc(doc(asLinked(), eventPath), {
      [`rsvp.${linkedUid}`]: "no",
      [`rsvpUpdatedAt.${linkedUid}`]: serverTimestamp(),
    }),
  );
  // L'ancien memberId n'est plus une clé du compte.
  await assertFails(
    updateDoc(doc(asLinked(), eventPath), {
      [`rsvp.${formerMemberId}`]: "yes",
      [`rsvpUpdatedAt.${formerMemberId}`]: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(asLinked(), eventPath), {
      [`rsvp.${linkedUid}`]: "maybe",
      [`rsvp.${formerMemberId}`]: "maybe",
    }),
  );
});

for (const field of ["rsvpUpdatedAt", "seenAt"]) {
  test(`${field} : uniquement sa clé, à l'heure serveur`, async () => {
    const eventPath = `clubs/${CLUB}/events/evA`;
    // Première écriture (champ absent) avec une clé étrangère.
    await assertFails(
      updateDoc(doc(as(PLAYER), eventPath), {
        [`${field}.${COACH.uid}`]: serverTimestamp(),
      }),
    );
    await assertFails(
      updateDoc(doc(as(PLAYER), eventPath), {
        [`${field}.${PLAYER.uid}`]: "abc",
      }),
    );
    await assertFails(
      updateDoc(doc(as(PLAYER), eventPath), {
        [`${field}.${PLAYER.uid}`]: Timestamp.fromDate(new Date("2030-01-01")),
      }),
    );
    await assertSucceeds(
      updateDoc(doc(as(PLAYER), eventPath), {
        [`${field}.${PLAYER.uid}`]: serverTimestamp(),
      }),
    );
    // Champ existant : clé étrangère toujours refusée.
    await assertFails(
      updateDoc(doc(as(PLAYER), eventPath), {
        [`${field}.${COACH.uid}`]: serverTimestamp(),
      }),
    );
  });
}

test("un coach crée un événement, un joueur non", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evNew`), { title: "Stage", teamIds: ["teamA"] }),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evNew2`), { title: "Pirate", teamIds: [] }),
  );
});

// ————————————————————————————————————————————————————————————————
// Lot 2 — parents : lecture des fiches limitée au strict nécessaire
// ————————————————————————————————————————————————————————————————

test("un parent lit la fiche de son enfant, celle du coach de l'équipe et celle d'un admin", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${PLAYER.uid}`)));
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${COACH.uid}`)));
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${ADMIN.uid}`)));
});

test("un parent ne lit pas la fiche d'un joueur d'une autre équipe", async () => {
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/members/${OTHER_PLAYER.uid}`)));
  await assertFails(getDocs(collection(as(PARENT), `clubs/${CLUB}/members`)));
});

test("member_accounts supprimé : ni lecture ni écriture", async () => {
  await assertFails(getDoc(doc(as(PLAYER), `clubs/${CLUB}/member_accounts/${PLAYER.uid}`)));
  await assertFails(getDocs(collection(as(ADMIN), `clubs/${CLUB}/member_accounts`)));
  await assertFails(
    setDoc(doc(as(INVITEE), `clubs/${CLUB}/member_accounts/${INVITEE.uid}`), {
      memberId: "precreated1",
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Lot 2 — conversations : participant vs non-participant, rename
// ————————————————————————————————————————————————————————————————

test("un participant lit sa conversation et ses messages, un non-participant non", async () => {
  await assertSucceeds(getDoc(doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}`)));
  await assertSucceeds(
    getDocs(collection(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`)),
  );
  await assertFails(getDoc(doc(as(OTHER_PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}`)));
  await assertFails(
    getDocs(collection(as(OTHER_PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`)),
  );
  await assertFails(getDoc(doc(as(PARENT), `clubs/${CLUB}/conversations/${CONV_TEAM}`)));
  await assertFails(getDoc(doc(as(STRANGER), `clubs/${CLUB}/conversations/${CONV_TEAM}`)));
});

test("un participant qui peut écrire renomme la conversation (≤ 80 caractères, ou null)", async () => {
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}`);
  await assertSucceeds(updateDoc(ref, { titleOverride: "Les Bleus", updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(ref, { titleOverride: null, updatedAt: serverTimestamp() }));
  await assertFails(
    updateDoc(ref, { titleOverride: "x".repeat(81), updatedAt: serverTimestamp() }),
  );
  await assertFails(updateDoc(ref, { titleOverride: 42, updatedAt: serverTimestamp() }));
});

test("un simple lecteur d'un canal admins_only ne le renomme pas, un admin oui", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_CLUB}`), {
      titleOverride: "Pirate",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/conversations/${CONV_CLUB}`), {
      titleOverride: "Toute l'asso",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(as(STRANGER), `clubs/${CLUB}/conversations/${CONV_TEAM}`), {
      titleOverride: "Pirate",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("participantProfiles reste écrit par les Functions : un participant ne le modifie pas", async () => {
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}`);
  await assertFails(
    updateDoc(ref, {
      [`participantProfiles.${PLAYER.uid}`]: { firstName: "Usurpé", role: "admin" },
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      titleOverride: "Les Bleus",
      participantProfiles: {},
      updatedAt: serverTimestamp(),
    }),
  );
});

test("le preview inbox n'accepte qu'un rôle connu et un prénom court", async () => {
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}`);
  await assertSucceeds(
    updateDoc(ref, {
      lastMessageAt: serverTimestamp(),
      lastMessagePreview: "Salut",
      lastSenderUid: PLAYER.uid,
      lastSenderFirstName: "Paul",
      lastSenderRole: "player",
      updatedAt: serverTimestamp(),
    }),
  );
  // Membre sans badge (ni admin, ni coach, ni joueur d'une équipe).
  await assertSucceeds(
    updateDoc(ref, {
      lastMessageAt: serverTimestamp(),
      lastSenderUid: PLAYER.uid,
      lastSenderRole: "member",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      lastMessageAt: serverTimestamp(),
      lastSenderUid: PLAYER.uid,
      lastSenderRole: "superadmin",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(ref, {
      lastMessageAt: serverTimestamp(),
      lastSenderUid: PLAYER.uid,
      lastSenderFirstName: "x".repeat(61),
      updatedAt: serverTimestamp(),
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Lot 2 — messages : création bornée
// ————————————————————————————————————————————————————————————————

test("un participant envoie un texte ; un non-participant ou un usurpateur non", async () => {
  await assertSucceeds(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/m1`), textMessage(PLAYER)),
  );
  await assertFails(
    setDoc(doc(as(OTHER_PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/m2`), textMessage(OTHER_PLAYER)),
  );
  // senderUid d'un autre.
  await assertFails(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/m3`), textMessage(COACH)),
  );
  // Lecteur d'un canal admins_only.
  await assertFails(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_CLUB}/messages/m4`), textMessage(PLAYER)),
  );
});

test("un message créé avec des réactions préremplies, un horodatage client ou des champs inconnus est refusé", async () => {
  const col = `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`;
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r1`), textMessage(PLAYER, { reactions: { "👍": [COACH.uid] } })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r2`), textMessage(PLAYER, { createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r3`), textMessage(PLAYER, { editedAt: serverTimestamp() })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r4`), textMessage(PLAYER, { deletedAt: serverTimestamp() })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r5`), textMessage(PLAYER, { pinned: true })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r6`), textMessage(PLAYER, { text: "x".repeat(4001) })),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/r7`), textMessage(PLAYER, { text: "" })),
  );
});

test("un message image doit pointer sur le bucket du projet sous le préfixe de l'expéditeur", async () => {
  const col = `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`;
  const ok = {
    type: "image",
    storagePath: chatMediaPath(CONV_TEAM, PLAYER.uid, "img1.jpg"),
    downloadUrl: chatMediaUrl(CONV_TEAM, PLAYER.uid, "img1.jpg"),
    thumbUrl: chatMediaUrl(CONV_TEAM, PLAYER.uid, "img1_thumb.png"),
    width: 1200,
    height: 800,
    senderUid: PLAYER.uid,
    createdAt: serverTimestamp(),
    reactions: {},
  };
  await assertSucceeds(setDoc(doc(as(PLAYER), `${col}/i1`), ok));
  // Préfixe d'un autre utilisateur.
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/i2`), {
      ...ok,
      storagePath: chatMediaPath(CONV_TEAM, COACH.uid, "img1.jpg"),
      downloadUrl: chatMediaUrl(CONV_TEAM, COACH.uid, "img1.jpg"),
      thumbUrl: chatMediaUrl(CONV_TEAM, COACH.uid, "img1_thumb.png"),
    }),
  );
  // Autre conversation.
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/i3`), {
      ...ok,
      storagePath: chatMediaPath(CONV_DM, PLAYER.uid, "img1.jpg"),
      downloadUrl: chatMediaUrl(CONV_DM, PLAYER.uid, "img1.jpg"),
      thumbUrl: chatMediaUrl(CONV_DM, PLAYER.uid, "img1_thumb.png"),
    }),
  );
  // Hébergeur externe.
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/i4`), { ...ok, downloadUrl: "https://evil.example/x.jpg" }),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/i5`), { ...ok, thumbUrl: "https://evil.example/x.jpg" }),
  );
  // Dimensions farfelues.
  await assertFails(setDoc(doc(as(PLAYER), `${col}/i6`), { ...ok, width: -1 }));
  await assertFails(setDoc(doc(as(PLAYER), `${col}/i7`), { ...ok, height: "800" }));
});

test("un sondage démarre sans aucun vote", async () => {
  const col = `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`;
  const poll = {
    type: "poll",
    text: "Match samedi ?",
    pollQuestion: "Match samedi ?",
    pollOptions: [{ id: "o0", text: "Oui" }, { id: "o1", text: "Non" }],
    pollVotes: { o0: [], o1: [] },
    pollAllowMultiple: false,
    senderUid: COACH.uid,
    createdAt: serverTimestamp(),
    reactions: {},
  };
  await assertSucceeds(setDoc(doc(as(COACH), `${col}/p1`), poll));
  await assertFails(
    setDoc(doc(as(COACH), `${col}/p2`), { ...poll, pollVotes: { o0: [PLAYER.uid], o1: [] } }),
  );
  // Pas de sondage en DM (≤ 2 participants).
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/conversations/${CONV_DM}/messages/p3`), poll),
  );
});

test("un participant réagit à un message existant, uniquement avec son uid", async () => {
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/msgOld`);
  await assertSucceeds(updateDoc(ref, { reactions: { "👍": [PLAYER.uid] } }));
  await assertSucceeds(updateDoc(ref, { reactions: { "👍": [PLAYER.uid], "🔥": [PLAYER.uid] } }));
  await assertFails(updateDoc(ref, { reactions: { "👍": [PLAYER.uid, COACH.uid], "🔥": [PLAYER.uid] } }));
  await assertFails(updateDoc(ref, { reactions: { "👍": [PLAYER.uid], "🔥": [PLAYER.uid], "🍕": [PLAYER.uid] } }));
});

test("un participant vote sur un sondage, uniquement avec son uid", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/pollOld`), {
      type: "poll",
      text: "Q ?",
      pollQuestion: "Q ?",
      pollOptions: [{ id: "o0", text: "A" }, { id: "o1", text: "B" }],
      pollVotes: { o0: [], o1: [] },
      pollAllowMultiple: false,
      senderUid: COACH.uid,
      createdAt: Timestamp.now(),
      reactions: {},
    });
  });
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/pollOld`);
  await assertSucceeds(updateDoc(ref, { pollVotes: { o0: [PLAYER.uid], o1: [] } }));
  await assertFails(updateDoc(ref, { pollVotes: { o0: [PLAYER.uid], o1: [COACH.uid] } }));
});

test("vote sondage : heure du vote (pollVoteTimes) seulement pour soi, horodatage serveur", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/pollTimes`), {
      type: "poll",
      text: "Q ?",
      pollQuestion: "Q ?",
      pollOptions: [{ id: "o0", text: "A" }, { id: "o1", text: "B" }],
      pollVotes: { o0: [], o1: [] },
      pollAllowMultiple: false,
      senderUid: COACH.uid,
      createdAt: Timestamp.now(),
      reactions: {},
    });
  });
  const ref = doc(as(PLAYER), `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/pollTimes`);
  // Parcours nominal (app / portail) : vote + mon heure, puis changement de vote.
  await assertSucceeds(updateDoc(ref, {
    pollVotes: { o0: [PLAYER.uid], o1: [] },
    [`pollVoteTimes.${PLAYER.uid}`]: { at: serverTimestamp(), edited: false },
  }));
  await assertSucceeds(updateDoc(ref, {
    pollVotes: { o0: [], o1: [PLAYER.uid] },
    [`pollVoteTimes.${PLAYER.uid}`]: { at: serverTimestamp(), edited: true },
  }));
  // Pas l'heure d'un autre, pas d'heure choisie par le client, pas de champ en plus.
  await assertFails(updateDoc(ref, {
    [`pollVoteTimes.${COACH.uid}`]: { at: serverTimestamp(), edited: false },
  }));
  await assertFails(updateDoc(ref, {
    [`pollVoteTimes.${PLAYER.uid}`]: { at: Timestamp.fromMillis(0), edited: false },
  }));
  await assertFails(updateDoc(ref, {
    [`pollVoteTimes.${PLAYER.uid}`]: { at: serverTimestamp(), edited: false, x: 1 },
  }));
});

// ————————————————————————————————————————————————————————————————
// Lot 2 — journal d'activité borné
// ————————————————————————————————————————————————————————————————

test("un coach journalise un type connu ; type inconnu ou résumé trop long refusés", async () => {
  const base = {
    type: "events_created",
    actorUid: COACH.uid,
    actorDisplayName: "Coach",
    count: 1,
    summary: "Entraînement ajouté",
    createdAt: serverTimestamp(),
  };
  await assertSucceeds(setDoc(doc(as(COACH), `clubs/${CLUB}/activity_events/a1`), base));
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/activity_events/a2`), { ...base, type: "hacked" }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/activity_events/a3`), { ...base, summary: "x".repeat(201) }),
  );
  await assertFails(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/activity_events/a4`), { ...base, actorUid: PLAYER.uid }),
  );
});

// ————————————————————————————————————————————————————————————————
// Mise à jour obligatoire — app_config lisible par tous, écrit par personne
// ————————————————————————————————————————————————————————————————

test("app_config/mobile est lisible sans connexion mais jamais modifiable par un client", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), "app_config/mobile"), {
      minVersionAndroid: "2.2.6",
      minVersionIos: "2.2.6",
    });
  });
  await assertSucceeds(getDoc(doc(anonymous(), "app_config/mobile")));
  await assertSucceeds(getDoc(doc(as(PLAYER), "app_config/mobile")));
  await assertFails(
    setDoc(doc(anonymous(), "app_config/mobile"), { minVersionAndroid: "0.0.1" }),
  );
  await assertFails(
    updateDoc(doc(as(ADMIN), "app_config/mobile"), { minVersionIos: "0.0.1" }),
  );
});

// ————————————————————————————————————————————————————————————————
// Paiements : champs Stripe du club, journal de cotisation
// ————————————————————————————————————————————————————————————————

const FEE_PATH = `clubs/${CLUB}/fee_seasons/s1/member_fees/${PLAYER.uid}`;

/** Fiche cotisation du joueur : 50 € payés sur 150 €. */
async function seedMemberFee() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `clubs/${CLUB}/fee_seasons/s1`), {
      active: true,
      tiers: [{ tierId: "t1", amountCents: 15000 }],
    });
    await setDoc(doc(db, FEE_PATH), {
      tierId: "t1",
      amountPaidCents: 5000,
      status: "partiel",
    });
  });
}

/** Paiement hors ligne tel qu'écrit par l'app / le portail (fiche + journal). */
function offlineCreditBatch(user, { after = 8000, eventOverrides = {} } = {}) {
  const db = as(user);
  const batch = writeBatch(db);
  batch.update(doc(db, FEE_PATH), {
    amountPaidCents: after,
    paidVia: "offline",
    offlineMethod: "cheque",
    updatedAt: serverTimestamp(),
  });
  batch.set(doc(collection(db, `${FEE_PATH}/payment_events`)), {
    type: "offline_credit",
    deltaCents: after - 5000,
    amountPaidCentsBefore: 5000,
    amountPaidCentsAfter: after,
    statusAfter: "partiel",
    actorUid: user.uid,
    createdAt: serverTimestamp(),
    ...eventOverrides,
  });
  return batch.commit();
}

test("un admin ne modifie pas le compte Stripe du club", async () => {
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { stripeConnectStatus: "complete" }),
  );
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { stripeConnectedAccountId: "acct_autre" }),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { onlinePaymentEnabled: true }),
  );
});

test("un admin enregistre un paiement hors ligne avec son entrée de journal", async () => {
  await seedMemberFee();
  await assertSucceeds(offlineCreditBatch(ADMIN));
});

test("le journal refuse un auteur, un type CB ou un montant incohérents", async () => {
  await seedMemberFee();
  await assertFails(offlineCreditBatch(ADMIN, { eventOverrides: { actorUid: COACH.uid } }));
  await assertFails(offlineCreditBatch(ADMIN, { eventOverrides: { type: "card_credit" } }));
  await assertFails(offlineCreditBatch(ADMIN, { eventOverrides: { amountPaidCentsAfter: 15000 } }));
  await assertFails(
    offlineCreditBatch(ADMIN, {
      eventOverrides: { createdAt: Timestamp.fromDate(new Date(2020, 0, 1)) },
    }),
  );
});

test("un coach n'écrit ni la fiche ni le journal de cotisation", async () => {
  await seedMemberFee();
  await assertFails(offlineCreditBatch(COACH));
});

test("les champs de rapprochement CB sont réservés aux Functions", async () => {
  await seedMemberFee();
  await assertFails(
    updateDoc(doc(as(ADMIN), FEE_PATH), { appliedExternalPaymentIds: ["pi_x"] }),
  );
  await assertFails(updateDoc(doc(as(ADMIN), FEE_PATH), { overpaidCents: 0 }));
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/fee_seasons/s1/member_fees/precreated1`), {
      tierId: "t1",
      amountPaidCents: 0,
      paymentIntentId: "pi_x",
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Données personnelles : profils `users`
// ————————————————————————————————————————————————————————————————

test("un compte d'un autre club ne lit pas le profil d'un membre", async () => {
  await assertFails(getDoc(doc(as(STRANGER), `users/${ADMIN.uid}`)));
  await assertFails(getDoc(doc(as(STRANGER), `users/${PARENT.uid}`)));
});

test("membres et parents d'un même club lisent leurs profils", async () => {
  await assertSucceeds(getDoc(doc(as(COACH), `users/${PLAYER.uid}`)));
  await assertSucceeds(getDoc(doc(as(ADMIN), `users/${PARENT.uid}`)));
  await assertSucceeds(getDoc(doc(as(PARENT), `users/${COACH.uid}`)));
  await assertSucceeds(getDoc(doc(as(STRANGER), `users/${STRANGER.uid}`)));
});

test("un compte ne s'ajoute pas lui-même à memberClubIds", async () => {
  await assertFails(
    updateDoc(doc(as(STRANGER), `users/${STRANGER.uid}`), { memberClubIds: [CLUB] }),
  );
  await assertFails(
    setDoc(doc(as({ uid: "nouveau1", email: "n@x.fr" }), "users/nouveau1"), {
      email: "n@x.fr",
      memberClubIds: [CLUB],
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Droits des coachs : invitations et équipes
// ————————————————————————————————————————————————————————————————

async function setCoachPermissions(permissions) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), `clubs/${CLUB}`), { coachPermissions: permissions });
  });
}

const PLAYER_INVITE = {
  code: "NEW777",
  status: "pending",
  type: "member",
  memberId: "precreated1",
  email: "recrue@club.fr",
  expiresAt: inviteExpiry(),
};

test("un coach sans le droit d'inviter ne crée ni invitation ni fiche", async () => {
  await setCoachPermissions({ canInvitePlayers: false });
  await assertFails(setDoc(doc(as(COACH), `clubs/${CLUB}/invitations/new7`), PLAYER_INVITE));
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/members/pre10`), {
      status: "active",
    }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/invitations/inv1`), { status: "expired" }),
  );
  // L'admin n'est pas concerné par le réglage.
  await assertSucceeds(setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new8`), PLAYER_INVITE));
});

test("le droit d'inviter est accordé par défaut au coach", async () => {
  await assertSucceeds(setDoc(doc(as(COACH), `clubs/${CLUB}/invitations/new9`), PLAYER_INVITE));
});

test("un coach ne crée pas d'équipe et ne s'ajoute pas aux coachs", async () => {
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamC`), { name: "C", coachIds: [COACH.uid] }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamB`), { coachIds: [COACH.uid] }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamA`), {
      coachIds: [COACH.uid, OTHER_PLAYER.uid],
    }),
  );
});

test("un coach gère le roster de son équipe seulement, selon son droit", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamA`), {
      playerIds: [PLAYER.uid, OTHER_PLAYER.uid],
    }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamB`), { playerIds: [OTHER_PLAYER.uid] }),
  );
  await setCoachPermissions({ canManageTeamRoster: false });
  // Ajout réel (une écriture identique à l'état courant serait un no-op).
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamA`), {
      playerIds: [PLAYER.uid, OTHER_PLAYER.uid, "recrue"],
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamA`), { messagingLink: "https://chat.example" }),
  );
});

test("lien fédération : écrit par les Functions seulement, classement lisible par le club", async () => {
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/teams/teamA`), {
      federation: { provider: "ffvb", teamKey: "x" },
    }),
  );
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/teams/teamA`), {
      federation: { provider: "ffvb", teamKey: "x" },
    }),
  );
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/teams/teamFed`), {
      name: "Fed",
      federation: { provider: "ffvb" },
    }),
  );
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/teams/teamA/federation/standings`), {
      rows: [],
    });
  });
  await assertSucceeds(getDoc(doc(as(PLAYER), `clubs/${CLUB}/teams/teamA/federation/standings`)));
  await assertFails(getDoc(doc(as(STRANGER), `clubs/${CLUB}/teams/teamA/federation/standings`)));
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/teams/teamA/federation/standings`), { rows: [] }),
  );
});

// ————————————————————————————————————————————————————————————————
// Demandes de rôle (join_requests) : flux supprimé, refus par défaut
// ————————————————————————————————————————————————————————————————

test("join_requests n'existe plus : ni création ni lecture", async () => {
  await assertFails(
    setDoc(doc(as(PLAYER), "join_requests/req2"), {
      userId: PLAYER.uid,
      clubId: CLUB,
      roleRequested: "coach",
      status: "pending",
    }),
  );
  await assertFails(
    getDocs(query(collection(as(ADMIN), "join_requests"), where("clubId", "==", CLUB))),
  );
});

// ————————————————————————————————————————————————————————————————
// Droits purs (nov. 2026) : droits et relation coach écrits par le serveur
// ————————————————————————————————————————————————————————————————

test("aucun client n'écrit des droits ni la relation coach, même un admin", async () => {
  for (const actor of [ADMIN, PLAYER]) {
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/members/${PLAYER.uid}`), {
        permissions: ["admin"],
      }),
    );
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/members/${PLAYER.uid}`), {
        coachTeamIds: ["teamB"],
      }),
    );
  }
  // Équipes de la fiche : maintenues par le trigger d'équipe, jamais par un
  // client (ni admin, ni coach de l'équipe).
  for (const actor of [ADMIN, COACH]) {
    await assertFails(
      updateDoc(doc(as(actor), `clubs/${CLUB}/members/${PLAYER.uid}`), {
        teamIds: ["teamA", "teamB"],
      }),
    );
  }
  // L'ancien champ `role` ne s'écrit plus non plus.
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/members/${PLAYER.uid}`), { role: "admin" }),
  );
});

test("un responsable membres édite une fiche, pas ses droits", async () => {
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/members/${PLAYER.uid}`), {
      firstName: "Paulo",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(
    updateDoc(doc(as(TREASURER), `clubs/${CLUB}/members/${PLAYER.uid}`), {
      firstName: "Pirate",
    }),
  );
});

test("clubMemberships n'est plus modifiable par son titulaire", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `users/${PLAYER.uid}`), {
      clubMemberships: [{ clubId: OTHER_CLUB }],
    }),
  );
  await assertFails(
    setDoc(doc(as({ uid: "nouveau2", email: "n2@x.fr" }), "users/nouveau2"), {
      email: "n2@x.fr",
      clubMemberships: [{ clubId: CLUB }],
    }),
  );
  await assertSucceeds(
    setDoc(doc(as({ uid: "nouveau3", email: "n3@x.fr" }), "users/nouveau3"), {
      email: "n3@x.fr",
      clubMemberships: [],
    }),
  );
});

test("l'index adminIds ne donne aucun droit", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), `clubs/${CLUB}`), {
      adminIds: [ADMIN.uid, PLAYER.uid],
    });
  });
  await assertFails(updateDoc(doc(as(PLAYER), `clubs/${CLUB}`), { name: "Pris" }));
  await assertFails(
    setDoc(doc(as(PLAYER), `clubs/${CLUB}/equipment/e1`), { name: "Ballons" }),
  );
});

test("seul un admin règle les capacités des coachs", async () => {
  await assertFails(
    updateDoc(doc(as(TREASURER), `clubs/${CLUB}`), {
      coachPermissions: { canCreateEvents: false },
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), {
      coachPermissions: { canCreateEvents: false },
      updatedAt: serverTimestamp(),
    }),
  );
});

test("le responsable cotisations lit et écrit les cotisations, rien d'autre", async () => {
  await seedMemberFee();
  await assertSucceeds(offlineCreditBatch(TREASURER));
  await assertSucceeds(
    getDocs(collection(as(TREASURER), `clubs/${CLUB}/fee_seasons/s1/member_fees`)),
  );
  await assertSucceeds(
    updateDoc(doc(as(TREASURER), `clubs/${CLUB}`), { onlinePaymentEnabled: true }),
  );
  await assertFails(updateDoc(doc(as(TREASURER), `clubs/${CLUB}`), { name: "Trésor" }));
  await assertFails(
    setDoc(doc(as(TREASURER), `clubs/${CLUB}/events/evT`), { title: "x", teamIds: ["teamA"] }),
  );
  await assertFails(
    setDoc(doc(as(TREASURER), `clubs/${CLUB}/announcements/annT`), {
      targetType: "Tous les membres",
      targetIds: [],
    }),
  );
});

test("un coach ne lit pas les cotisations du club sans le droit de les voir", async () => {
  await seedMemberFee();
  await assertFails(
    getDocs(collection(as(COACH), `clubs/${CLUB}/fee_seasons/s1/member_fees`)),
  );
  // Chacun lit sa propre cotisation.
  await assertSucceeds(getDoc(doc(as(PLAYER), FEE_PATH)));
});

// ——— Coach d'équipe : capacités limitées à ses équipes ———

test("un coach crée un événement pour ses équipes seulement, jamais pour tout le club", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evC1`), { title: "A", teamIds: ["teamA"] }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evC2`), { title: "B", teamIds: ["teamB"] }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evC3`), {
      title: "Club",
      teamIds: ["teamA"],
      allTeams: true,
    }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evC4`), { title: "Sans équipe", teamIds: [] }),
  );
  // Droit planning (admin) : toutes les équipes.
  await assertSucceeds(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evC5`), { title: "B", teamIds: ["teamB"] }),
  );
});

test("couper canCreateEvents bloque la création et l'édition du coach", async () => {
  await setCoachPermissions({ canCreateEvents: false });
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/events/evC6`), { title: "A", teamIds: ["teamA"] }),
  );
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), { canceled: true }));
});

test("un coach modifie ou annule un événement de son équipe, pas d'une autre", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), { title: "Entraînement modifié" }),
  );
  await assertSucceeds(updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), { canceled: true }));
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evB`), { canceled: true }));
  // Il ne déplace pas son événement vers une équipe qu'il n'entraîne pas.
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), { teamIds: ["teamB"] }),
  );
  // Suppression : droit planning seulement.
  await assertFails(deleteDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`)));
  await assertSucceeds(deleteDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evB`)));
});

test("l'appel coach n'existe plus : personne n'écrit `attendance`", async () => {
  const attendance = {
    [`attendance.${PLAYER.uid}`]: { status: "present", markedBy: COACH.uid },
  };
  // Même sur un événement qu'il gère entièrement : seul le RSVP compte.
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), attendance));
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evB`), attendance));
  // Le droit planning non plus (une entrée sans `markedBy` se lirait comme un RSVP).
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evA`), {
      [`attendance.${PLAYER.uid}`]: "yes",
    }),
  );
});

test("synchro d'audience : retirer une réponse oui, en réécrire une non", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), `clubs/${CLUB}/events/evA`), {
      teamMemberIds: [PLAYER.uid, COACH.uid],
      rsvp: { [PLAYER.uid]: "yes" },
    });
  });
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), {
      teamMemberIds: [COACH.uid],
      [`rsvp.${PLAYER.uid}`]: deleteField(),
    }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), {
      teamMemberIds: [COACH.uid, PLAYER.uid],
      [`rsvp.${PLAYER.uid}`]: "no",
    }),
  );
});

test("un coach publie une annonce pour ses équipes, pas pour le club", async () => {
  await assertSucceeds(
    setDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annC1`), {
      message: "Match samedi",
      targetType: "Équipes",
      targetIds: ["teamA"],
    }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annC2`), {
      message: "À tous",
      targetType: "Tous les membres",
      targetIds: [],
    }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annC3`), {
      message: "Autre équipe",
      targetType: "Équipes",
      targetIds: ["teamA", "teamB"],
    }),
  );
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annC4`), {
      message: "Catégorie",
      targetType: "Catégories",
      targetIds: ["U13"],
    }),
  );
  // Il gère l'annonce de son équipe, pas celle du club.
  await assertSucceeds(deleteDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annA`)));
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annAll`), { message: "x" }),
  );
  // Droit annonces (admin) : tout le club.
  await assertSucceeds(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/announcements/annC5`), {
      message: "À tous",
      targetType: "Tous les membres",
      targetIds: [],
    }),
  );
});

test("couper canPublishTeamAnnouncements bloque les annonces du coach", async () => {
  await setCoachPermissions({ canPublishTeamAnnouncements: false });
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/announcements/annC6`), {
      message: "Match",
      targetType: "Équipes",
      targetIds: ["teamA"],
    }),
  );
});

test("licence : coach autorisé, sur un membre de ses équipes seulement", async () => {
  const license = { playerInfo: { license: "LIC123" }, updatedAt: serverTimestamp() };
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/${PLAYER.uid}`), license),
  );
  await setCoachPermissions({ canEditMemberLicenses: true });
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/${PLAYER.uid}`), license),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/${OTHER_PLAYER.uid}`), license),
  );
});

test("canal coaches_and_admins : coach d'équipe ou droit messagerie", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/conversations/convStaff`), {
      type: "staff",
      title: "Staff",
      participantUids: [ADMIN.uid, COACH.uid, PLAYER.uid, TREASURER.uid],
      writePolicy: "coaches_and_admins",
    });
  });
  const send = (user) =>
    setDoc(doc(as(user), `clubs/${CLUB}/conversations/convStaff/messages/m-${user.uid}`), {
      ...textMessage(user),
    });
  await assertSucceeds(send(COACH));
  await assertSucceeds(send(ADMIN));
  await assertFails(send(PLAYER));
  await assertFails(send(TREASURER));
});

// ————————————————————————————————————————————————————————————————
// Audit droits purs (nov. 2026) : portée coach
// ————————————————————————————————————————————————————————————————

test("les défauts coach des règles suivent le catalogue partagé", () => {
  const catalog = JSON.parse(
    readFileSync(new URL("../shared/permissions_catalog.json", import.meta.url), "utf8"),
  );
  const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
  const calls = [...rules.matchAll(/coach(?:Can|Flag)\(clubId, '(\w+)', (true|false)\)/g)];
  assert.ok(calls.length > 0);
  for (const [, flag, value] of calls) {
    assert.ok(flag in catalog.coachFlags, `capacité inconnue : ${flag}`);
    assert.equal(value === "true", catalog.coachFlags[flag], `défaut de ${flag}`);
  }
  for (const [, permission] of rules.matchAll(/can\(clubId, '(\w+)'\)/g)) {
    assert.ok(catalog.permissions.includes(permission), `droit inconnu : ${permission}`);
  }
});

test("un coach ne modifie ni n'annule un événement « tout le club »", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/events/evAll`), {
      title: "AG du club",
      teamIds: ["teamA", "teamB"],
      allTeams: true,
    });
  });
  const ref = (user) => doc(as(user), `clubs/${CLUB}/events/evAll`);
  await assertFails(updateDoc(ref(COACH), { title: "Piraté" }));
  await assertFails(updateDoc(ref(COACH), { canceled: true }));
  await assertFails(
    updateDoc(ref(COACH), {
      [`attendance.${PLAYER.uid}`]: { status: "present", markedBy: COACH.uid },
    }),
  );
  await assertSucceeds(updateDoc(ref(ADMIN), { title: "AG 2026" }));
});

test("un coach ne modifie un événement multi-équipes que s'il les entraîne toutes", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/events/evAB`), {
      title: "Tournoi A + B",
      teamIds: ["teamA", "teamB"],
    });
  });
  const ref = doc(as(COACH), `clubs/${CLUB}/events/evAB`);
  await assertFails(updateDoc(ref, { title: "Piraté" }));
  // Plus d'appel coach : seul le RSVP compte.
  await assertFails(
    updateDoc(ref, { [`attendance.${PLAYER.uid}`]: { status: "present", markedBy: COACH.uid } }),
  );
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/events/evA`), { title: "Entraînement A bis" }),
  );
});

test("un coach ne crée pas de fiche à l'id d'un compte existant", async () => {
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/members/${STRANGER.uid}`), preCreatedMember()),
  );
});

test("un coach ne gère que les invitations des fiches de ses équipes ou non rattachées", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `clubs/${CLUB}/members/precreatedB`), {
      permissions: [],
      coachTeamIds: [],
      status: "active",
      teamIds: ["teamB"],
      firstName: "Bob",
      activeInvitationId: "invB",
    });
    await setDoc(doc(db, `clubs/${CLUB}/invitations/invB`), {
      code: "BBB222",
      status: "pending",
      type: "member",
      memberId: "precreatedB",
      email: "bob@club.fr",
    });
  });
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/invitations/invB`), { status: "expired" }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/precreatedB`), { firstName: "Robert" }),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/invB`), { status: "expired" }),
  );
  // Ajout de membre : fiche + invitation dans la même transaction.
  const db = as(COACH);
  const batch = writeBatch(db);
  batch.set(doc(db, `clubs/${CLUB}/members/preNew`), preCreatedMember());
  batch.set(doc(db, `clubs/${CLUB}/invitations/invNew`), {
    code: "NEW333",
    status: "pending",
    type: "member",
    memberId: "preNew",
    email: "new@club.fr",
    expiresAt: inviteExpiry(),
  });
  await assertSucceeds(batch.commit());
  // Fiche pré-inscrite avec droits, sans équipe : un coach ne détourne pas
  // son invitation (il récupérerait ses droits en l'acceptant).
  await env.withSecurityRulesDisabled(async (ctx) => {
    const adminDb = ctx.firestore();
    await setDoc(doc(adminDb, `clubs/${CLUB}/members/preBoss`), {
      permissions: ["admin"],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
      activeInvitationId: "invBoss",
    });
    await setDoc(doc(adminDb, `clubs/${CLUB}/invitations/invBoss`), {
      code: "BOSS55",
      status: "pending",
      type: "member",
      memberId: "preBoss",
      email: "boss@club.fr",
    });
  });
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/invitations/invBoss`), { email: COACH.email }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/preBoss`), {
      snapshot: { email: COACH.email },
    }),
  );
  // Une invitation coach vise toujours une fiche.
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/invitations/invOrphan`), {
      code: "ORP444",
      status: "pending",
      type: "member",
      email: "orphan@club.fr",
    }),
  );
});

test("les champs de re-clé et d'anonymisation sont réservés aux Cloud Functions", async () => {
  for (const extra of [
    { formerMemberIds: ["x"] },
    { rekeyPendingFrom: "x" },
    { anonymizedAt: serverTimestamp() },
  ]) {
    await assertFails(
      updateDoc(doc(as(ADMIN), `clubs/${CLUB}/members/${PLAYER.uid}`), extra),
    );
  }
});

test("le droit cotisations implique la lecture des cotisations", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/members/feesOnly1`), {
      accountUid: "feesOnly1",
      permissions: ["manageFees"],
      coachTeamIds: [],
      teamIds: [],
      status: "active",
    });
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/fee_seasons/s1/member_fees/${PLAYER.uid}`), {
      amountPaidCents: 0,
    });
  });
  const feesOnly = { uid: "feesOnly1", email: "fees@club.fr" };
  await assertSucceeds(
    getDoc(doc(as(feesOnly), `clubs/${CLUB}/fee_seasons/s1/member_fees/${PLAYER.uid}`)),
  );
});

test("un coach modère les conversations de ses équipes seulement", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_CLUB}/messages/mClub`), {
      type: "text",
      text: "Info",
      senderUid: ADMIN.uid,
      createdAt: Timestamp.now(),
      reactions: {},
    });
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_TEAM}/messages/mTeam`), {
      type: "text",
      text: "Salut",
      senderUid: PLAYER.uid,
      createdAt: Timestamp.now(),
      reactions: {},
    });
  });
  const remove = (conv, msg) =>
    updateDoc(doc(as(COACH), `clubs/${CLUB}/conversations/${conv}/messages/${msg}`), {
      deletedAt: serverTimestamp(),
      deletedByUid: COACH.uid,
    });
  await assertFails(remove(CONV_CLUB, "mClub"));
  await assertSucceeds(remove(CONV_TEAM, "mTeam"));
});

// ————————————————————————————————————————————————————————————————
// Revue sécurité (17 nov. 2026)
// ————————————————————————————————————————————————————————————————

/** Responsable membres : droit `manageMembers` seul, ni admin ni coach. */
const MEMBERS_MANAGER = { uid: "manager1", email: "manager@club.fr" };

/** Fiches pré-inscrites qui confèrent quelque chose à qui les récupère. */
async function seedRightsBearingMembers() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, `clubs/${CLUB}/members/${MEMBERS_MANAGER.uid}`), {
      accountUid: MEMBERS_MANAGER.uid,
      permissions: ["manageMembers"],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
    });
    await setDoc(doc(db, `users/${MEMBERS_MANAGER.uid}`), {
      email: MEMBERS_MANAGER.email,
      emailNorm: MEMBERS_MANAGER.email,
      memberClubIds: [CLUB],
    });
    // Fiche pré-inscrite admin (droit posé par `setMemberPermissions`).
    await setDoc(doc(db, `clubs/${CLUB}/members/preBoss`), {
      permissions: ["admin"],
      coachTeamIds: [],
      status: "active",
      teamIds: [],
      activeInvitationId: "invBoss",
    });
    await setDoc(doc(db, `clubs/${CLUB}/invitations/invBoss`), {
      code: "BOSS55",
      status: "pending",
      type: "member",
      memberId: "preBoss",
      email: "boss@club.fr",
      expiresAt: inviteExpiry(),
    });
    // Coach de l'équipe B, aussi joueur de l'équipe A.
    await setDoc(doc(db, `clubs/${CLUB}/members/preCoachB`), {
      permissions: [],
      coachTeamIds: ["teamB"],
      status: "active",
      teamIds: ["teamA", "teamB"],
      activeInvitationId: "invCoachB",
    });
    await setDoc(doc(db, `clubs/${CLUB}/invitations/invCoachB`), {
      code: "COACHB",
      status: "pending",
      type: "member",
      memberId: "preCoachB",
      email: "coachb@club.fr",
      expiresAt: inviteExpiry(),
    });
    // Coach d'équipe sans `teamIds` (trigger d'équipe pas encore passé).
    await setDoc(doc(db, `clubs/${CLUB}/members/preCoachNoTeam`), {
      permissions: [],
      coachTeamIds: ["teamB"],
      status: "active",
    });
  });
}

/** Invitation membre telle qu'écrite par l'app / le portail. */
function memberInvite(memberId, email, extra = {}) {
  return {
    code: "REV123",
    status: "pending",
    type: "member",
    memberId,
    email,
    expiresAt: inviteExpiry(),
    ...extra,
  };
}

test("un responsable membres ne s'attribue pas une fiche pré-inscrite admin via une invitation", async () => {
  await seedRightsBearingMembers();
  const asManager = as(MEMBERS_MANAGER);
  await assertFails(
    setDoc(
      doc(asManager, `clubs/${CLUB}/invitations/invHijack`),
      memberInvite("preBoss", MEMBERS_MANAGER.email),
    ),
  );
  await assertFails(
    updateDoc(doc(asManager, `clubs/${CLUB}/invitations/invBoss`), {
      email: MEMBERS_MANAGER.email,
      updatedAt: serverTimestamp(),
    }),
  );
  // Fiche portant une relation coach : même règle.
  await assertFails(
    setDoc(
      doc(asManager, `clubs/${CLUB}/invitations/invHijack2`),
      memberInvite("preCoachB", MEMBERS_MANAGER.email),
    ),
  );
  await assertFails(
    updateDoc(doc(asManager, `clubs/${CLUB}/invitations/invCoachB`), {
      email: MEMBERS_MANAGER.email,
    }),
  );
  // L'admin, lui, invite et corrige l'e-mail de ces fiches.
  await assertSucceeds(
    setDoc(
      doc(as(ADMIN), `clubs/${CLUB}/invitations/invBoss2`),
      memberInvite("preBoss", "boss2@club.fr"),
    ),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/invBoss`), {
      email: "vrai-boss@club.fr",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("un responsable membres invite toujours une fiche sans droit (parcours nominal)", async () => {
  await seedRightsBearingMembers();
  const asManager = as(MEMBERS_MANAGER);
  await assertSucceeds(
    setDoc(
      doc(asManager, `clubs/${CLUB}/invitations/invMgr1`),
      memberInvite("precreated1", "ines2@club.fr"),
    ),
  );
  await assertSucceeds(
    updateDoc(doc(asManager, `clubs/${CLUB}/invitations/inv1`), {
      email: "ines3@club.fr",
      expiresAt: inviteExpiry(),
      updatedAt: serverTimestamp(),
    }),
  );
  // Ajout de membre : fiche + invitation dans la même transaction.
  const batch = writeBatch(asManager);
  batch.set(doc(asManager, `clubs/${CLUB}/members/preMgr`), preCreatedMember());
  batch.set(
    doc(asManager, `clubs/${CLUB}/invitations/invMgr2`),
    memberInvite("preMgr", "nina@club.fr"),
  );
  await assertSucceeds(batch.commit());
});

test("un coach ne récupère pas la fiche d'un coach d'une autre équipe", async () => {
  await seedRightsBearingMembers();
  const asCoach = as(COACH);
  // Fiche aussi joueuse de son équipe : avant, coachesAny(teamIds) suffisait.
  await assertFails(
    setDoc(
      doc(asCoach, `clubs/${CLUB}/invitations/invC1`),
      memberInvite("preCoachB", COACH.email),
    ),
  );
  await assertFails(
    updateDoc(doc(asCoach, `clubs/${CLUB}/invitations/invCoachB`), {
      email: COACH.email,
    }),
  );
  await assertFails(
    updateDoc(doc(asCoach, `clubs/${CLUB}/members/preCoachB`), {
      snapshot: { email: COACH.email },
    }),
  );
  // Relation coach sans `teamIds` : « sans équipe » ne suffit plus.
  await assertFails(
    setDoc(
      doc(asCoach, `clubs/${CLUB}/invitations/invC2`),
      memberInvite("preCoachNoTeam", COACH.email),
    ),
  );
  // Fiche joueur de son équipe (champs coachTeamIds / permissions absents) : OK.
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/members/preBare`), {
      status: "active",
      teamIds: ["teamA"],
    });
  });
  await assertSucceeds(
    setDoc(
      doc(asCoach, `clubs/${CLUB}/invitations/invC3`),
      memberInvite("preBare", "bare@club.fr"),
    ),
  );
});

test("invitation : code au format client, expiration présente et bornée, code figé", async () => {
  const ref = (id) => doc(as(ADMIN), `clubs/${CLUB}/invitations/${id}`);
  const noExpiry = memberInvite("precreated1", "a@club.fr");
  delete noExpiry.expiresAt;
  await assertFails(setDoc(ref("x1"), noExpiry));
  await assertFails(
    setDoc(ref("x2"), memberInvite("precreated1", "a@club.fr", { expiresAt: inviteExpiry(365) })),
  );
  await assertFails(
    setDoc(ref("x3"), memberInvite("precreated1", "a@club.fr", { code: "abc" })),
  );
  await assertFails(
    setDoc(ref("x4"), memberInvite("precreated1", "a@club.fr", { expiresAt: "demain" })),
  );
  await assertSucceeds(setDoc(ref("x5"), memberInvite("precreated1", "a@club.fr")));
  // Mise à jour : code figé, prolongation bornée.
  await assertFails(updateDoc(ref("inv1"), { code: "ABC124" }));
  await assertFails(updateDoc(ref("inv1"), { expiresAt: inviteExpiry(365) }));
  await assertSucceeds(updateDoc(ref("inv1"), { expiresAt: inviteExpiry(7) }));
});

// ——— Événement multi-équipes : coach d'une partie des équipes ———

async function seedMultiTeamEvent() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/events/evAB`), {
      title: "Tournoi A + B",
      teamIds: ["teamA", "teamB"],
      teamMemberIds: [PLAYER.uid, OTHER_PLAYER.uid],
      rsvp: { [PLAYER.uid]: "yes", [OTHER_PLAYER.uid]: "yes" },
      rsvpUpdatedAt: { [PLAYER.uid]: Timestamp.now(), [OTHER_PLAYER.uid]: Timestamp.now() },
      seenAt: { [PLAYER.uid]: Timestamp.now(), [OTHER_PLAYER.uid]: Timestamp.now() },
    });
  });
}

test("multi-équipes : un coach d'une seule équipe ne vide pas l'audience ni les réponses des autres", async () => {
  await seedMultiTeamEvent();
  const ref = doc(as(COACH), `clubs/${CLUB}/events/evAB`);
  // Réécriture de l'audience (retire le joueur de l'équipe B).
  await assertFails(updateDoc(ref, { teamMemberIds: [PLAYER.uid] }));
  await assertFails(
    updateDoc(ref, {
      teamMemberIds: arrayRemove(OTHER_PLAYER.uid),
      [`rsvp.${OTHER_PLAYER.uid}`]: deleteField(),
    }),
  );
  // Plusieurs retraits d'un coup.
  await assertFails(updateDoc(ref, { teamMemberIds: [] }));
  // Purge des réponses / vues d'un joueur qui reste convoqué.
  await assertFails(updateDoc(ref, { [`rsvp.${OTHER_PLAYER.uid}`]: deleteField() }));
  await assertFails(updateDoc(ref, { [`rsvpUpdatedAt.${OTHER_PLAYER.uid}`]: deleteField() }));
  await assertFails(updateDoc(ref, { [`seenAt.${OTHER_PLAYER.uid}`]: deleteField() }));
  // Le droit planning (admin) garde la main.
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evAB`), {
      teamMemberIds: arrayRemove(OTHER_PLAYER.uid),
      [`rsvp.${OTHER_PLAYER.uid}`]: deleteField(),
    }),
  );
});

test("multi-équipes : la synchro de roster du coach reste possible pour ses joueurs", async () => {
  await seedMultiTeamEvent();
  const ref = doc(as(COACH), `clubs/${CLUB}/events/evAB`);
  // Ajout au roster de son équipe (app : addAudienceToUpcomingTeamEvents).
  await assertSucceeds(updateDoc(ref, { teamMemberIds: arrayUnion("recrue1") }));
  // Retrait de son joueur (app : removeAudienceFromUpcomingTeamEvents).
  await assertSucceeds(
    updateDoc(ref, {
      teamMemberIds: arrayRemove(PLAYER.uid),
      [`rsvp.${PLAYER.uid}`]: deleteField(),
      [`rsvpUpdatedAt.${PLAYER.uid}`]: deleteField(),
      [`seenAt.${PLAYER.uid}`]: deleteField(),
    }),
  );
});

test("une réponse à soi ne permet pas d'écrire la vue seenAt d'un autre", async () => {
  await assertFails(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${ADMIN.uid}`]: "yes",
      [`seenAt.${PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${ADMIN.uid}`]: "yes",
      [`rsvpUpdatedAt.${ADMIN.uid}`]: serverTimestamp(),
      [`seenAt.${ADMIN.uid}`]: serverTimestamp(),
    }),
  );
});

// ——— RSVP direct : audience de l'événement, valeur connue ———

test("RSVP direct : seulement sur un événement où l'on est convoqué, valeur connue", async () => {
  // Joueur de l'équipe B, absent de l'audience de evA.
  await assertFails(
    updateDoc(doc(as(OTHER_PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${OTHER_PLAYER.uid}`]: "yes",
      [`rsvpUpdatedAt.${OTHER_PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  // Valeur inventée.
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "banane",
    }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: { status: "yes" },
    }),
  );
  // « Sans réponse » (badge RSVP de l'app) reste possible.
  await assertSucceeds(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${PLAYER.uid}`]: "none",
      [`rsvpUpdatedAt.${PLAYER.uid}`]: serverTimestamp(),
    }),
  );
  // La vue « seenAt » n'est pas concernée.
  await assertSucceeds(
    updateDoc(doc(as(OTHER_PLAYER), `clubs/${CLUB}/events/evA`), {
      [`seenAt.${OTHER_PLAYER.uid}`]: serverTimestamp(),
    }),
  );
});

test("RSVP direct sur un événement sans équipe : convoqués et coachs du club", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), `clubs/${CLUB}/events/evNoTeam`), {
      title: "Réunion",
      teamIds: [],
      teamMemberIds: [OTHER_PLAYER.uid],
    });
  });
  const answer = (user) =>
    updateDoc(doc(as(user), `clubs/${CLUB}/events/evNoTeam`), {
      [`rsvp.${user.uid}`]: "yes",
      [`rsvpUpdatedAt.${user.uid}`]: serverTimestamp(),
    });
  await assertSucceeds(answer(OTHER_PLAYER));
  await assertSucceeds(answer(COACH));
  await assertFails(answer(PLAYER));
});

// ——— Conversations : aperçu et citations ———

test("aperçu inbox : badge cohérent avec la fiche, heure serveur, dernier expéditeur seulement", async () => {
  const conv = (user) => doc(as(user), `clubs/${CLUB}/conversations/${CONV_TEAM}`);
  const preview = (user, role, extra = {}) => ({
    lastMessageAt: serverTimestamp(),
    lastMessagePreview: "Salut",
    lastSenderUid: user.uid,
    lastSenderRole: role,
    updatedAt: serverTimestamp(),
    ...extra,
  });
  await assertFails(updateDoc(conv(PLAYER), preview(PLAYER, "admin")));
  await assertFails(updateDoc(conv(PLAYER), preview(PLAYER, "coach")));
  await assertSucceeds(updateDoc(conv(COACH), preview(COACH, "coach")));
  await assertSucceeds(updateDoc(conv(ADMIN), preview(ADMIN, "admin")));
  await assertFails(
    updateDoc(
      conv(PLAYER),
      preview(PLAYER, "player", { lastMessageAt: Timestamp.fromDate(new Date("2030-01-01")) }),
    ),
  );
  // Dernier expéditeur = ADMIN : un autre participant ne réécrit pas l'aperçu
  // seul ; l'admin oui (édition de son dernier message).
  await assertFails(
    updateDoc(conv(PLAYER), { lastMessagePreview: "Piraté", updatedAt: serverTimestamp() }),
  );
  await assertSucceeds(
    updateDoc(conv(ADMIN), { lastMessagePreview: "Corrigé", updatedAt: serverTimestamp() }),
  );
});

test("citation : l'auteur cité est celui du message cité", async () => {
  const col = `clubs/${CLUB}/conversations/${CONV_TEAM}/messages`;
  const reply = (extra) =>
    textMessage(PLAYER, { replyToMessageId: "msgOld", replyToText: "Ancien", ...extra });
  await assertSucceeds(
    setDoc(doc(as(PLAYER), `${col}/rep1`), reply({ replyToSenderUid: COACH.uid })),
  );
  await assertSucceeds(setDoc(doc(as(PLAYER), `${col}/rep2`), reply({})));
  await assertFails(
    setDoc(doc(as(PLAYER), `${col}/rep3`), reply({ replyToSenderUid: ADMIN.uid })),
  );
  // Pas de citation sans message cité.
  await assertFails(
    setDoc(
      doc(as(PLAYER), `${col}/rep4`),
      textMessage(PLAYER, { replyToSenderUid: COACH.uid, replyToText: "x" }),
    ),
  );
});

// ——— Compteur de membres, saisons de cotisation ———

test("memberCount : +1 seulement côté client", async () => {
  await assertFails(updateDoc(doc(as(COACH), `clubs/${CLUB}`), { memberCount: 8 }));
  await assertFails(updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { memberCount: 0 }));
  await assertSucceeds(updateDoc(doc(as(ADMIN), `clubs/${CLUB}`), { memberCount: 4 }));
});

test("une saison de cotisation ne se supprime pas côté client", async () => {
  await seedMemberFee();
  await assertSucceeds(
    updateDoc(doc(as(TREASURER), `clubs/${CLUB}/fee_seasons/s1`), { active: false }),
  );
  await assertFails(deleteDoc(doc(as(ADMIN), `clubs/${CLUB}/fee_seasons/s1`)));
  await assertFails(deleteDoc(doc(as(TREASURER), `clubs/${CLUB}/fee_seasons/s1`)));
});

// ——— Outils d'entraînement : préparation et retours de séance ———

const COACH2 = { uid: "coach2", email: "coach2@club.fr" };
const COACH_B = { uid: "coachB", email: "coachb@club.fr" };
const TEAMMATE = { uid: "teammate1", email: "teammate@club.fr" };
const TRAINING = `clubs/${CLUB}/events/evTrain`;

/** Entraînement de l'équipe A, deux coachs, un coach de B, un coéquipier. */
async function seedTraining() {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [user, coachTeamIds, teamIds] of [
      [COACH2, ["teamA"], ["teamA"]],
      [COACH_B, ["teamB"], ["teamB"]],
      [TEAMMATE, [], ["teamA"]],
    ]) {
      await setDoc(doc(db, `clubs/${CLUB}/members/${user.uid}`), {
        accountUid: user.uid,
        permissions: [],
        coachTeamIds,
        status: "active",
        teamIds,
      });
    }
    await setDoc(doc(db, TRAINING), {
      title: "Entraînement",
      type: "training",
      teamIds: ["teamA"],
      teamMemberIds: [PLAYER.uid, TEAMMATE.uid],
      dateId: "20261120",
    });
    // Retour envoyé par COACH (écrit par la callable en réel).
    await setDoc(doc(db, `${TRAINING}/trainingFeedback/${COACH.uid}`), {
      clubId: CLUB,
      teamIds: ["teamA"],
      coachUid: COACH.uid,
      levelRating: 4,
      engagementRating: 5,
    });
    await setDoc(
      doc(db, `${TRAINING}/trainingFeedback/${COACH.uid}/playerMessages/${PLAYER.uid}`),
      { clubId: CLUB, coachUid: COACH.uid, memberId: PLAYER.uid, message: "Bravo" },
    );
  });
}

const plan = (extra = {}) => ({ teamIds: ["teamA"], notes: "Échauffement", ...extra });

test("entraînement : chaque coach écrit sa préparation, ses collègues la lisent", async () => {
  await seedTraining();
  const mine = `${TRAINING}/trainingPlans/${COACH.uid}`;
  await assertSucceeds(setDoc(doc(as(COACH), mine), plan()));
  await assertSucceeds(setDoc(doc(as(COACH), `${mine}/drills/d1`), { title: "Service" }));
  await assertSucceeds(getDoc(doc(as(COACH2), mine)));
  await assertSucceeds(getDocs(collection(as(COACH2), `${TRAINING}/trainingPlans`)));
  await assertSucceeds(getDocs(collection(as(COACH2), `${mine}/drills`)));
  // Un coach n'écrit pas dans la partie d'un collègue.
  await assertFails(setDoc(doc(as(COACH2), mine), plan()));
  await assertFails(setDoc(doc(as(COACH2), `${mine}/drills/d2`), { title: "Bloc" }));
  // Équipes de la préparation = équipes de l'entraînement.
  await assertFails(
    setDoc(doc(as(COACH), mine), plan({ teamIds: ["teamA", "teamB"] })),
  );
});

test("entraînement : l'admin lit la préparation sans l'écrire, joueur et coach d'une autre équipe refusés", async () => {
  await seedTraining();
  const mine = `${TRAINING}/trainingPlans/${COACH.uid}`;
  await assertSucceeds(setDoc(doc(as(COACH), mine), plan()));
  await assertSucceeds(getDoc(doc(as(ADMIN), mine)));
  await assertFails(setDoc(doc(as(ADMIN), `${TRAINING}/trainingPlans/${ADMIN.uid}`), plan()));
  await assertFails(getDoc(doc(as(PLAYER), mine)));
  await assertFails(getDoc(doc(as(PARENT), mine)));
  await assertFails(getDoc(doc(as(COACH_B), mine)));
  await assertFails(
    setDoc(doc(as(COACH_B), `${TRAINING}/trainingPlans/${COACH_B.uid}`), plan()),
  );
});

test("entraînement : le brouillon de retour reste privé au coach", async () => {
  await seedTraining();
  const draft = `${TRAINING}/trainingFeedbackDrafts/${COACH.uid}`;
  await assertSucceeds(setDoc(doc(as(COACH), draft), { levelRating: 3 }));
  await assertSucceeds(getDoc(doc(as(COACH), draft)));
  await assertFails(getDoc(doc(as(COACH2), draft)));
  await assertFails(getDoc(doc(as(ADMIN), draft)));
  await assertFails(getDoc(doc(as(PLAYER), draft)));
  await assertFails(setDoc(doc(as(COACH2), draft), { levelRating: 1 }));
});

test("entraînement : le retour collectif est lu par toute l'équipe, jamais écrit par un client", async () => {
  await seedTraining();
  const feedback = `${TRAINING}/trainingFeedback/${COACH.uid}`;
  for (const user of [PLAYER, TEAMMATE, PARENT, COACH, COACH2, ADMIN]) {
    await assertSucceeds(getDoc(doc(as(user), feedback)));
  }
  await assertSucceeds(getDocs(collection(as(PLAYER), `${TRAINING}/trainingFeedback`)));
  for (const user of [OTHER_PLAYER, COACH_B, TREASURER, STRANGER]) {
    await assertFails(getDoc(doc(as(user), feedback)));
  }
  await assertFails(setDoc(doc(as(COACH), feedback), { levelRating: 5, engagementRating: 5 }));
  await assertFails(updateDoc(doc(as(ADMIN), feedback), { levelRating: 1 }));
});

test("entraînement : un message perso n'est lu que par le joueur, ses parents, les coachs et l'admin", async () => {
  await seedTraining();
  const message = `${TRAINING}/trainingFeedback/${COACH.uid}/playerMessages/${PLAYER.uid}`;
  for (const user of [PLAYER, PARENT, COACH, COACH2, ADMIN]) {
    await assertSucceeds(getDoc(doc(as(user), message)));
  }
  for (const user of [TEAMMATE, OTHER_PLAYER, COACH_B, STRANGER]) {
    await assertFails(getDoc(doc(as(user), message)));
  }
  // Liste des messages d'un coach : staff seulement.
  const messages = `${TRAINING}/trainingFeedback/${COACH.uid}/playerMessages`;
  await assertSucceeds(getDocs(collection(as(ADMIN), messages)));
  await assertFails(getDocs(collection(as(PLAYER), messages)));
  await assertFails(setDoc(doc(as(COACH), message), { message: "Modifié" }));
});

test("entraînement : trainingFeedbackSentBy n'est jamais écrit par un client", async () => {
  await seedTraining();
  await assertFails(
    updateDoc(doc(as(COACH), TRAINING), { trainingFeedbackSentBy: arrayUnion(COACH.uid) }),
  );
  await assertFails(
    updateDoc(doc(as(ADMIN), TRAINING), { trainingFeedbackSentBy: [ADMIN.uid] }),
  );
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/events/evNew`), {
      title: "Entraînement",
      type: "training",
      teamIds: ["teamA"],
      trainingFeedbackSentBy: [COACH.uid],
    }),
  );
});

test("entraînement : l'état perso (flemme, retours lus) reste privé au compte", async () => {
  const mine = `users/${COACH.uid}/trainingFeedbackState/${CLUB}_evTraining`;
  await assertSucceeds(
    setDoc(doc(as(COACH), mine), { clubId: CLUB, eventId: "evTraining", skipped: true }),
  );
  await assertSucceeds(getDoc(doc(as(COACH), mine)));
  await assertSucceeds(
    getDocs(query(collection(as(COACH), `users/${COACH.uid}/trainingFeedbackState`), where("clubId", "==", CLUB))),
  );
  for (const user of [COACH2, ADMIN, PLAYER]) {
    await assertFails(getDoc(doc(as(user), mine)));
    await assertFails(setDoc(doc(as(user), mine), { skipped: false }));
  }
});
