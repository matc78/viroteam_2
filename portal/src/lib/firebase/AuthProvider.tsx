"use client";

import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail as firebaseSendPasswordResetEmail,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { validatePassword } from "@/lib/auth/passwordPolicy";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { getFirebaseAuth, resetAppFirestore } from "@/lib/firebase/app";
import { clearLinkedMemberIdCache } from "@/lib/firebase/memberService";
import {
  passwordResetErrorMessage,
  toAuthActionError,
} from "@/lib/firebase/authErrors";
import { isDevAuthBypassEnabled } from "@/lib/firebase/devAuth";
import {
  EmailUsedWithPasswordError,
  GOOGLE_SIGN_IN_CANCELLED,
  signInWithGoogle as firebaseSignInWithGoogle,
} from "@/lib/firebase/googleAuth";
import { ClubRecord, getClubsByIds } from "@/lib/firebase/clubService";
import {
  ACTIVE_CLUB_STORAGE_KEY,
  ACTIVE_SPACE_STORAGE_KEY,
  MemberRoles,
} from "@/lib/firebase/constants";
import { claimPendingGuardianInvites } from "@/lib/firebase/guardianService";
import {
  adminClubIds,
  bureauClubIds,
  familyClubIds,
  membershipRoleForClub,
  ViroUserProfile,
  type PortalSpace,
} from "@/lib/firebase/types";
import {
  createUserProfile,
  getUserProfile,
} from "@/lib/firebase/userService";
import { SessionErrorState } from "@/components/auth/SessionErrorState";

export type { PortalSpace };

/** `error` : connecté côté Firebase mais profil / clubs illisibles (écran Réessayer). */
type AuthStatus = "loading" | "signedOut" | "signedIn" | "error";

/** Délai max accordé au désenregistrement push avant la déconnexion. */
const STOP_WEB_PUSH_TIMEOUT_MS = 2_000;

/** État exposé par le contexte Auth du portail. */
type AuthContextValue = {
  /** État de la session Firebase + profil. */
  status: AuthStatus;
  /** Utilisateur Firebase Auth courant. */
  user: User | null;
  /** Document Firestore `users/{uid}`. */
  profile: ViroUserProfile | null;
  /** Clubs où l’utilisateur est admin (sous-ensemble de bureauClubs). */
  adminClubs: ClubRecord[];
  /** Clubs avec accès Bureau (admin, coach ou joueur). */
  bureauClubs: ClubRecord[];
  /** Clubs où l’utilisateur a un lien parent actif. */
  familyClubs: ClubRecord[];
  /** Club sélectionné dans l’espace courant. */
  activeClub: ClubRecord | null;
  /** Rôle membership du club actif (admin | coach | player), ou null. */
  activeClubRole: string | null;
  /** Vrai si l’utilisateur administre au moins un club. */
  isAdmin: boolean;
  /** Vrai si accès Bureau (admin, coach ou joueur sur au moins un club). */
  isBureauUser: boolean;
  /** Vrai si le club actif a le rôle admin. */
  isActiveClubAdmin: boolean;
  /** Vrai si le club actif a le rôle coach (pas admin). */
  isActiveClubCoach: boolean;
  /** Vrai si le club actif a le rôle player (pas admin/coach). */
  isActiveClubPlayer: boolean;
  /** Vrai si au moins un parentLink est active. */
  isParent: boolean;
  /** Espace courant (bureau vs famille). */
  activeSpace: PortalSpace;
  /** Persiste le club actif (localStorage). */
  setActiveClubId: (clubId: string) => void;
  /** Bascule bureau / famille. */
  setActiveSpace: (space: PortalSpace) => void;
  /** Sélection atomique club + espace (pastilles header). Faux si club hors périmètre. */
  selectClubContext: (clubId: string, space: PortalSpace) => boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (options?: { createProfileIfMissing?: boolean }) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  /** Envoie le lien Firebase de réinitialisation du mot de passe. */
  sendPasswordResetEmail: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Recharge profil + clubs après mutation Firestore (ne rejette jamais). */
  refreshProfile: () => Promise<void>;
  /** Relance le chargement de session après un échec (`status === "error"`). */
  retrySession: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredClubId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ACTIVE_CLUB_STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStoredClubId(clubId: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (clubId) localStorage.setItem(ACTIVE_CLUB_STORAGE_KEY, clubId);
    else localStorage.removeItem(ACTIVE_CLUB_STORAGE_KEY);
  } catch {
    // ignore
  }
}

function readStoredSpace(): PortalSpace | null {
  if (typeof window === "undefined") return null;
  try {
    const value = localStorage.getItem(ACTIVE_SPACE_STORAGE_KEY);
    if (value === "bureau" || value === "family") return value;
    return null;
  } catch {
    return null;
  }
}

function writeStoredSpace(space: PortalSpace): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ACTIVE_SPACE_STORAGE_KEY, space);
  } catch {
    // ignore
  }
}

function pickActiveClub(
  clubs: ClubRecord[],
  preferredId: string | null,
): ClubRecord | null {
  if (clubs.length === 0) return null;
  if (preferredId) {
    const found = clubs.find((club) => club.id === preferredId);
    if (found) return found;
  }
  return clubs[0];
}

/** Démarre le push web quand le navigateur est libre (module chargé à la demande). */
function startWebPushWhenIdle(): void {
  if (typeof window === "undefined") return;
  const start = () => {
    void import("@/lib/firebase/pushNotificationService")
      .then(({ startWebPush }) => startWebPush())
      .catch((error) => {
        console.info("Web push non démarré", error);
      });
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 5_000 });
  } else {
    setTimeout(start, 2_000);
  }
}

/** Désenregistre le push web sans jamais bloquer la déconnexion plus de 2 s. */
async function stopWebPushBounded(): Promise<void> {
  const stop = import("@/lib/firebase/pushNotificationService")
    .then(({ stopWebPush }) => stopWebPush())
    .catch(() => undefined);
  await Promise.race([
    stop,
    new Promise<void>((resolve) => setTimeout(resolve, STOP_WEB_PUSH_TIMEOUT_MS)),
  ]);
}

function resolveSpace(params: {
  isBureauUser: boolean;
  isParent: boolean;
  stored: PortalSpace | null;
}): PortalSpace {
  if (params.isBureauUser && params.isParent) {
    return params.stored ?? "bureau";
  }
  if (params.isParent) return "family";
  return "bureau";
}

/** Provider Auth + clubs bureau / famille pour le portail. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ViroUserProfile | null>(null);
  const [adminClubs, setAdminClubs] = useState<ClubRecord[]>([]);
  const [bureauClubs, setBureauClubs] = useState<ClubRecord[]>([]);
  const [familyClubs, setFamilyClubs] = useState<ClubRecord[]>([]);
  const [activeClubId, setActiveClubIdState] = useState<string | null>(null);
  const [activeSpace, setActiveSpaceState] = useState<PortalSpace>("bureau");

  /** Incrémenté à chaque chargement : un chargement périmé n’écrit plus d’état. */
  const sessionGenerationRef = useRef(0);
  /** Uids dont les invitations parent en attente ont déjà été réclamées. */
  const claimedUidsRef = useRef(new Set<string>());
  /** Dernier compte chargé (détecte un changement de compte sans rechargement). */
  const lastUidRef = useRef<string | null>(null);

  const loadSession = useCallback(async (firebaseUser: User | null) => {
    const generation = ++sessionGenerationRef.current;
    const isStale = () => generation !== sessionGenerationRef.current;

    if (!firebaseUser) {
      lastUidRef.current = null;
      claimedUidsRef.current.clear();
      clearLinkedMemberIdCache();
      setUser(null);
      setProfile(null);
      setAdminClubs([]);
      setBureauClubs([]);
      setFamilyClubs([]);
      setActiveClubIdState(null);
      setStatus("signedOut");
      // Vide le cache mémoire Firestore après déconnexion (poste partagé).
      void resetAppFirestore();
      return;
    }

    setUser(firebaseUser);
    // Changement de compte dans le même onglet : on vide le cache Firestore
    // (aucun listener n’est actif tant que la session n’est pas `signedIn`).
    const previousUid = lastUidRef.current;
    lastUidRef.current = firebaseUser.uid;
    if (previousUid && previousUid !== firebaseUser.uid) {
      clearLinkedMemberIdCache();
      await resetAppFirestore();
      if (isStale()) return;
    }
    const userProfile = await getUserProfile(firebaseUser.uid);
    if (isStale()) return;

    const adminIds = adminClubIds(userProfile);
    const bureauIds = bureauClubIds(userProfile);
    const familyIds = familyClubIds(userProfile);
    // Une seule lecture par club (admin ⊂ bureau, et un club peut être bureau + famille).
    const loadedClubs = await getClubsByIds([
      ...bureauIds,
      ...adminIds,
      ...familyIds,
    ]);
    if (isStale()) return;
    const clubsIn = (ids: string[]) =>
      loadedClubs.filter((club) => ids.includes(club.id));
    const loadedAdminClubs = clubsIn(adminIds);
    const loadedBureauClubs = clubsIn(bureauIds);
    const loadedFamilyClubs = clubsIn(familyIds);

    setProfile(userProfile);
    setAdminClubs(loadedAdminClubs);
    setBureauClubs(loadedBureauClubs);
    setFamilyClubs(loadedFamilyClubs);

    const isBureau = loadedBureauClubs.length > 0;
    const isParentUser = loadedFamilyClubs.length > 0;
    const nextSpace = resolveSpace({
      isBureauUser: isBureau,
      isParent: isParentUser,
      stored: readStoredSpace(),
    });
    setActiveSpaceState(nextSpace);
    writeStoredSpace(nextSpace);

    const clubPool =
      nextSpace === "family" ? loadedFamilyClubs : loadedBureauClubs;
    const preferred = readStoredClubId();
    const active = pickActiveClub(clubPool, preferred);
    setActiveClubIdState(active?.id ?? null);
    if (active) writeStoredClubId(active.id);

    setStatus("signedIn");
    return userProfile?.emailNorm || firebaseUser.email?.trim().toLowerCase() || "";
  }, []);

  /**
   * Charge la session sans jamais rejeter. Un échec au premier chargement
   * passe en `error` ; un échec de rafraîchissement garde la session courante.
   * Les invitations parent sont réclamées ensuite, hors chemin critique.
   */
  const runSession = useCallback(
    async (firebaseUser: User | null): Promise<void> => {
      const generation = sessionGenerationRef.current + 1;
      let emailNorm: string | undefined;
      try {
        emailNorm = await loadSession(firebaseUser);
      } catch (error) {
        console.error("Auth session error", error);
        if (generation !== sessionGenerationRef.current) return;
        setStatus((current) => (current === "signedIn" ? current : "error"));
        return;
      }
      if (!firebaseUser || generation !== sessionGenerationRef.current) return;

      startWebPushWhenIdle();

      if (!emailNorm || claimedUidsRef.current.has(firebaseUser.uid)) return;
      claimedUidsRef.current.add(firebaseUser.uid);
      try {
        const claimed = await claimPendingGuardianInvites(emailNorm);
        if (claimed > 0 && generation === sessionGenerationRef.current) {
          await loadSession(firebaseUser);
        }
      } catch (error) {
        console.error("Claim guardian invites", error);
      }
    },
    [loadSession],
  );

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void runSession(firebaseUser);
    });
    return unsubscribe;
  }, [runSession]);

  const setActiveClubId = useCallback(
    (clubId: string) => {
      const allowed = [...bureauClubs, ...familyClubs].some(
        (club) => club.id === clubId,
      );
      if (!allowed) return;
      setActiveClubIdState(clubId);
      writeStoredClubId(clubId);
    },
    [bureauClubs, familyClubs],
  );

  const setActiveSpace = useCallback(
    (space: PortalSpace) => {
      setActiveSpaceState(space);
      writeStoredSpace(space);
      const pool = space === "family" ? familyClubs : bureauClubs;
      setActiveClubIdState((currentId) => {
        if (currentId && pool.some((club) => club.id === currentId)) {
          return currentId;
        }
        const next = pool[0];
        if (next) writeStoredClubId(next.id);
        return next?.id ?? null;
      });
    },
    [bureauClubs, familyClubs],
  );

  const selectClubContext = useCallback(
    (clubId: string, space: PortalSpace) => {
      const pool = space === "family" ? familyClubs : bureauClubs;
      if (!pool.some((club) => club.id === clubId)) return false;
      setActiveSpaceState(space);
      writeStoredSpace(space);
      setActiveClubIdState(clubId);
      writeStoredClubId(clubId);
      return true;
    },
    [bureauClubs, familyClubs],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      if (isDevAuthBypassEnabled()) {
        const response = await fetch("/api/dev/auth/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const payload = (await response.json()) as {
          token?: string;
          error?: string;
          code?: string;
        };
        if (!response.ok || !payload.token) {
          throw toAuthActionError({
            message: payload.error ?? "Connexion dev impossible.",
            code: payload.code,
          });
        }
        await signInWithCustomToken(getFirebaseAuth(), payload.token);
        return;
      }

      await signInWithEmailAndPassword(
        getFirebaseAuth(),
        email.trim(),
        password,
      );
    } catch (error) {
      throw toAuthActionError(error);
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (options?: { createProfileIfMissing?: boolean }) => {
      try {
        await firebaseSignInWithGoogle(options);
        if (options?.createProfileIfMissing) {
          // Profil éventuellement créé après le premier chargement de session.
          await runSession(getFirebaseAuth().currentUser);
        }
      } catch (error) {
        if (error instanceof EmailUsedWithPasswordError) {
          throw error;
        }
        // Popup fermée : propagée telle quelle pour que le formulaire coupe son loader.
        if (error instanceof Error && error.message === GOOGLE_SIGN_IN_CANCELLED) {
          throw error;
        }
        throw toAuthActionError(error);
      }
    },
    [runSession],
  );

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
    }) => {
      const policyError = validatePassword(params.password);
      if (policyError) {
        throw new Error(policyError);
      }
      try {
        const cred = await createUserWithEmailAndPassword(
          getFirebaseAuth(),
          params.email.trim(),
          params.password,
        );
        await createUserProfile({
          uid: cred.user.uid,
          email: params.email,
          displayName: params.displayName.trim(),
        });
      } catch (error) {
        throw toAuthActionError(error);
      }
      // onAuthStateChanged a lu la session avant la création du profil.
      await runSession(getFirebaseAuth().currentUser);
    },
    [runSession],
  );

  const sendPasswordResetEmail = useCallback(async (email: string) => {
    try {
      await firebaseSendPasswordResetEmail(getFirebaseAuth(), email.trim());
    } catch (error) {
      const resetMessage = passwordResetErrorMessage(error);
      // Compte inconnu : succès neutre (anti-énumération), comme l’app.
      if (resetMessage === null) return;
      throw new Error(resetMessage);
    }
  }, []);

  const logout = useCallback(async () => {
    writeStoredClubId(null);
    await stopWebPushBounded();
    await signOut(getFirebaseAuth());
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await runSession(user);
  }, [runSession, user]);

  const retrySession = useCallback(() => {
    const currentUser = getFirebaseAuth().currentUser;
    setStatus("loading");
    void runSession(currentUser);
  }, [runSession]);

  const clubPool = activeSpace === "family" ? familyClubs : bureauClubs;
  const activeClub = useMemo(
    () => clubPool.find((club) => club.id === activeClubId) ?? clubPool[0] ?? null,
    [clubPool, activeClubId],
  );

  const activeClubRole = useMemo(
    () => membershipRoleForClub(profile, activeClub?.id),
    [profile, activeClub?.id],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      adminClubs,
      bureauClubs,
      familyClubs,
      activeClub,
      activeClubRole,
      isAdmin: adminClubs.length > 0,
      isBureauUser: bureauClubs.length > 0,
      isActiveClubAdmin: activeClubRole === MemberRoles.admin,
      isActiveClubCoach: activeClubRole === MemberRoles.coach,
      isActiveClubPlayer: activeClubRole === MemberRoles.player,
      isParent: familyClubs.length > 0,
      activeSpace,
      setActiveClubId,
      setActiveSpace,
      selectClubContext,
      signIn,
      signInWithGoogle,
      signUp,
      sendPasswordResetEmail,
      logout,
      refreshProfile,
      retrySession,
    }),
    [
      status,
      user,
      profile,
      adminClubs,
      bureauClubs,
      familyClubs,
      activeClub,
      activeClubRole,
      activeSpace,
      setActiveClubId,
      setActiveSpace,
      selectClubContext,
      signIn,
      signInWithGoogle,
      signUp,
      sendPasswordResetEmail,
      logout,
      refreshProfile,
      retrySession,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {status === "error" ? (
        <SessionErrorState onRetry={retrySession} onLogout={logout} />
      ) : null}
    </AuthContext.Provider>
  );
}

/** Accède au contexte Auth du portail. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }
  return ctx;
}
