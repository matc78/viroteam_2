// Tests des règles Firestore ViroTeam v2 (émulateur).
// Lancer : `cd rules-tests && npm test` (firebase-tools + Java requis).
//
// Chaque test rejoue une faille corrigée dans le lot 1 sécurité (2 sept. 2026),
// le lot 2 chat / parents (28 sept. 2026), ou un parcours nominal qui doit
// continuer à fonctionner.

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
      memberId: ADMIN.uid,
      accountUid: ADMIN.uid,
      role: "admin",
      status: "active",
      teamIds: [],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${COACH.uid}`), {
      memberId: COACH.uid,
      accountUid: COACH.uid,
      role: "coach",
      status: "active",
      teamIds: ["teamA"],
    });
    await setDoc(doc(db, `clubs/${CLUB}/members/${PLAYER.uid}`), {
      memberId: PLAYER.uid,
      accountUid: PLAYER.uid,
      role: "player",
      status: "active",
      teamIds: ["teamA"],
      firstName: "Paul",
      lastName: "Joueur",
      snapshot: { displayName: "Paul Joueur", email: PLAYER.email },
    });
    // Fiche pré-créée (enfant sans compte) + invitation en attente.
    await setDoc(doc(db, `clubs/${CLUB}/members/precreated1`), {
      memberId: "precreated1",
      role: "player",
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
      role: "player",
      type: "member",
      memberId: "precreated1",
      email: INVITEE.email,
    });
    await setDoc(doc(db, `clubs/${CLUB}/invitations/invAdmin`), {
      code: "ADM999",
      status: "pending",
      role: "admin",
      type: "member",
      email: "futur.admin@club.fr",
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
      memberId: OTHER_PLAYER.uid,
      accountUid: OTHER_PLAYER.uid,
      role: "player",
      status: "active",
      teamIds: ["teamB"],
      firstName: "Léa",
      lastName: "Autre",
    });
    for (const u of [ADMIN, COACH, PLAYER, OTHER_PLAYER, STRANGER, INVITEE]) {
      await setDoc(doc(db, `users/${u.uid}`), { email: u.email, emailNorm: u.email });
    }
    for (const u of [ADMIN, COACH, PLAYER, OTHER_PLAYER]) {
      await setDoc(doc(db, `clubs/${CLUB}/member_accounts/${u.uid}`), { memberId: u.uid });
    }
    // Conversations système (participants maintenus par les Cloud Functions).
    await setDoc(doc(db, `clubs/${CLUB}/conversations/${CONV_TEAM}`), {
      type: "team",
      systemKey: "team:teamA",
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
    await setDoc(doc(db, `clubs/${CLUB}/teams/teamA`), { name: "Équipe A", playerIds: [PLAYER.uid] });
    await setDoc(doc(db, `clubs/${CLUB}/teams/teamB`), { name: "Équipe B", playerIds: [] });
    await setDoc(doc(db, `clubs/${CLUB}/events/evA`), { title: "Entraînement A", teamIds: ["teamA"] });
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
      role: "admin",
      status: "active",
    }),
  );
});

test("un compte connecté ne peut pas créer sa fiche joueur dans un club où il n'est pas invité", async () => {
  await assertFails(
    setDoc(doc(as(STRANGER), `clubs/${CLUB}/members/${STRANGER.uid}`), {
      memberId: STRANGER.uid,
      role: "player",
      status: "active",
    }),
  );
});

test("le fondateur crée son club puis sa fiche admin (parcours club-setup)", async () => {
  const db = as(STRANGER);
  await assertSucceeds(
    setDoc(doc(db, "clubs/newClub"), {
      name: "Nouveau",
      sport: "Judo",
      adminIds: [STRANGER.uid],
      memberCount: 1,
    }),
  );
  await assertSucceeds(
    setDoc(doc(db, `clubs/newClub/members/${STRANGER.uid}`), {
      memberId: STRANGER.uid,
      accountUid: STRANGER.uid,
      role: "admin",
      status: "active",
    }),
  );
});

test("le fondateur crée club + fiche admin dans le même batch (transaction app)", async () => {
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
    role: "admin",
    status: "active",
  });
  await assertSucceeds(batch.commit());
});

test("un batch club+fiche joueur (pas admin) est refusé même si adminIds", async () => {
  const db = as(STRANGER);
  const batch = writeBatch(db);
  batch.set(doc(db, "clubs/newClubBatchPlayer"), {
    name: "Piège rôle",
    sport: "Judo",
    adminIds: [STRANGER.uid],
    memberCount: 1,
  });
  batch.set(doc(db, `clubs/newClubBatchPlayer/members/${STRANGER.uid}`), {
    memberId: STRANGER.uid,
    accountUid: STRANGER.uid,
    role: "player",
    status: "active",
  });
  await assertFails(batch.commit());
});

test("créer un club en se mettant admin avec d'autres uids est refusé", async () => {
  await assertFails(
    setDoc(doc(as(STRANGER), "clubs/newClub2"), {
      name: "Piège",
      adminIds: [STRANGER.uid, "victime"],
    }),
  );
});

// ————————————————————————————————————————————————————————————————
// Faille 2 : un membre écrit son propre rôle
// ————————————————————————————————————————————————————————————————

test("un joueur ne peut pas se donner le rôle admin", async () => {
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/members/${PLAYER.uid}`), { role: "admin" }),
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

test("un coach affecte un joueur à une équipe mais ne change pas son rôle", async () => {
  await assertSucceeds(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/${PLAYER.uid}`), { teamIds: ["teamA", "teamB"] }),
  );
  await assertFails(
    updateDoc(doc(as(COACH), `clubs/${CLUB}/members/${PLAYER.uid}`), { role: "coach" }),
  );
});

test("un membre ne peut pas s'approprier une fiche pré-créée (accountUid)", async () => {
  await assertFails(
    updateDoc(doc(as(STRANGER), `clubs/${CLUB}/members/precreated1`), {
      accountUid: STRANGER.uid,
      userId: STRANGER.uid,
    }),
  );
});

test("le client ne peut pas écrire member_accounts (index compte → fiche)", async () => {
  await assertFails(
    setDoc(doc(as(INVITEE), `clubs/${CLUB}/member_accounts/${INVITEE.uid}`), {
      memberId: "precreated1",
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
      role: "player",
      type: "member",
      email: "nouveau@club.fr",
    }),
  );
});

test("une invitation sans e-mail est refusée", async () => {
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new2`), {
      code: "NEW222",
      status: "pending",
      role: "player",
      type: "member",
    }),
  );
});

test("un coach ne peut pas inviter un admin, un admin oui", async () => {
  await assertFails(
    setDoc(doc(as(COACH), `clubs/${CLUB}/invitations/new3`), {
      code: "NEW333",
      status: "pending",
      role: "admin",
      type: "member",
      email: "boss@club.fr",
    }),
  );
  await assertSucceeds(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new4`), {
      code: "NEW444",
      status: "pending",
      role: "admin",
      type: "member",
      email: "boss@club.fr",
    }),
  );
});

test("les invitations parent (guardian) ne se créent pas côté client", async () => {
  await assertFails(
    setDoc(doc(as(ADMIN), `clubs/${CLUB}/invitations/new5`), {
      code: "GRD555",
      status: "pending",
      role: "player",
      type: "guardian",
      email: "papa@club.fr",
    }),
  );
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
    }),
  );
  await assertFails(
    updateDoc(doc(as(PLAYER), `clubs/${CLUB}/events/evA`), {
      [`rsvp.${COACH.uid}`]: "yes",
    }),
  );
});

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

test("un parent résout un uid via member_accounts (get) mais ne liste pas l'index", async () => {
  await assertSucceeds(getDoc(doc(as(PARENT), `clubs/${CLUB}/member_accounts/${COACH.uid}`)));
  await assertFails(getDocs(collection(as(PARENT), `clubs/${CLUB}/member_accounts`)));
  await assertSucceeds(getDocs(collection(as(PLAYER), `clubs/${CLUB}/member_accounts`)));
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
