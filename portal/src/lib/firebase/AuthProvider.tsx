"use client";

import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { getFirebaseAuth } from "@/lib/firebase/app";
import { authErrorMessage } from "@/lib/firebase/authErrors";
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
} from "@/lib/firebase/constants";
import { claimPendingGuardianInvites } from "@/lib/firebase/guardianService";
import {
  adminClubIds,
  familyClubIds,
  ViroUserProfile,
} from "@/lib/firebase/types";
import {
  createUserProfile,
  getUserProfile,
} from "@/lib/firebase/userService";

type AuthStatus = "loading" | "signedOut" | "signedIn";

export type PortalSpace = "bureau" | "family";

/** État exposé par le contexte Auth du portail. */
type AuthContextValue = {
  /** État de la session Firebase + profil. */
  status: AuthStatus;
  /** Utilisateur Firebase Auth courant. */
  user: User | null;
  /** Document Firestore `users/{uid}`. */
  profile: ViroUserProfile | null;
  /** Clubs où l’utilisateur a un rôle admin. */
  adminClubs: ClubRecord[];
  /** Clubs où l’utilisateur a un lien parent actif. */
  familyClubs: ClubRecord[];
  /** Club sélectionné dans l’espace courant. */
  activeClub: ClubRecord | null;
  /** Vrai si l’utilisateur administre au moins un club. */
  isAdmin: boolean;
  /** Vrai si au moins un parentLink est active. */
  isParent: boolean;
  /** Espace courant (bureau admin vs famille). */
  activeSpace: PortalSpace;
  /** Persiste le club actif (localStorage). */
  setActiveClubId: (clubId: string) => void;
  /** Bascule bureau / famille. */
  setActiveSpace: (space: PortalSpace) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signInWithGoogle: (options?: { createProfileIfMissing?: boolean }) => Promise<void>;
  signUp: (params: {
    email: string;
    password: string;
    displayName: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  /** Recharge profil + clubs après mutation Firestore. */
  refreshProfile: () => Promise<void>;
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

function resolveSpace(params: {
  isAdmin: boolean;
  isParent: boolean;
  stored: PortalSpace | null;
}): PortalSpace {
  if (params.isAdmin && params.isParent) {
    return params.stored ?? "bureau";
  }
  if (params.isParent) return "family";
  return "bureau";
}

/** Provider Auth + clubs admin / famille pour le portail. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ViroUserProfile | null>(null);
  const [adminClubs, setAdminClubs] = useState<ClubRecord[]>([]);
  const [familyClubs, setFamilyClubs] = useState<ClubRecord[]>([]);
  const [activeClubId, setActiveClubIdState] = useState<string | null>(null);
  const [activeSpace, setActiveSpaceState] = useState<PortalSpace>("bureau");

  const loadSession = useCallback(async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      setUser(null);
      setProfile(null);
      setAdminClubs([]);
      setFamilyClubs([]);
      setActiveClubIdState(null);
      setStatus("signedOut");
      return;
    }

    setUser(firebaseUser);
    let userProfile = await getUserProfile(firebaseUser.uid);

    const emailNorm =
      userProfile?.emailNorm || firebaseUser.email?.trim().toLowerCase() || "";
    if (emailNorm) {
      try {
        const claimed = await claimPendingGuardianInvites(emailNorm);
        if (claimed > 0) {
          userProfile = await getUserProfile(firebaseUser.uid);
        }
      } catch (error) {
        console.error("Claim guardian invites", error);
      }
    }

    setProfile(userProfile);

    const adminIds = adminClubIds(userProfile);
    const familyIds = familyClubIds(userProfile);
    const [loadedAdminClubs, loadedFamilyClubs] = await Promise.all([
      adminIds.length > 0 ? getClubsByIds(adminIds) : Promise.resolve([]),
      familyIds.length > 0 ? getClubsByIds(familyIds) : Promise.resolve([]),
    ]);
    setAdminClubs(loadedAdminClubs);
    setFamilyClubs(loadedFamilyClubs);

    const isAdminUser = loadedAdminClubs.length > 0;
    const isParentUser = loadedFamilyClubs.length > 0;
    const nextSpace = resolveSpace({
      isAdmin: isAdminUser,
      isParent: isParentUser,
      stored: readStoredSpace(),
    });
    setActiveSpaceState(nextSpace);
    writeStoredSpace(nextSpace);

    const clubPool = nextSpace === "family" ? loadedFamilyClubs : loadedAdminClubs;
    const preferred = readStoredClubId();
    const active = pickActiveClub(clubPool, preferred);
    setActiveClubIdState(active?.id ?? null);
    if (active) writeStoredClubId(active.id);

    setStatus("signedIn");
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      void loadSession(firebaseUser).catch((error) => {
        console.error("Auth session error", error);
        setUser(null);
        setProfile(null);
        setAdminClubs([]);
        setFamilyClubs([]);
        setActiveClubIdState(null);
        setStatus("signedOut");
      });
    });
    return unsubscribe;
  }, [loadSession]);

  const setActiveClubId = useCallback(
    (clubId: string) => {
      const allowed = [...adminClubs, ...familyClubs].some(
        (club) => club.id === clubId,
      );
      if (!allowed) return;
      setActiveClubIdState(clubId);
      writeStoredClubId(clubId);
    },
    [adminClubs, familyClubs],
  );

  const setActiveSpace = useCallback(
    (space: PortalSpace) => {
      setActiveSpaceState(space);
      writeStoredSpace(space);
      const pool = space === "family" ? familyClubs : adminClubs;
      setActiveClubIdState((currentId) => {
        if (currentId && pool.some((club) => club.id === currentId)) {
          return currentId;
        }
        const next = pool[0];
        if (next) writeStoredClubId(next.id);
        return next?.id ?? null;
      });
    },
    [adminClubs, familyClubs],
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
        };
        if (!response.ok || !payload.token) {
          throw new Error(payload.error ?? "Connexion dev impossible.");
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
      throw new Error(authErrorMessage(error));
    }
  }, []);

  const signInWithGoogle = useCallback(
    async (options?: { createProfileIfMissing?: boolean }) => {
      try {
        await firebaseSignInWithGoogle(options);
      } catch (error) {
        if (error instanceof EmailUsedWithPasswordError) {
          throw error;
        }
        if (error instanceof Error && error.message === GOOGLE_SIGN_IN_CANCELLED) {
          return;
        }
        throw new Error(authErrorMessage(error));
      }
    },
    [],
  );

  const signUp = useCallback(
    async (params: {
      email: string;
      password: string;
      displayName: string;
    }) => {
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
        throw new Error(authErrorMessage(error));
      }
    },
    [],
  );

  const logout = useCallback(async () => {
    writeStoredClubId(null);
    await signOut(getFirebaseAuth());
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    await loadSession(user);
  }, [loadSession, user]);

  const clubPool = activeSpace === "family" ? familyClubs : adminClubs;
  const activeClub = useMemo(
    () => clubPool.find((club) => club.id === activeClubId) ?? clubPool[0] ?? null,
    [clubPool, activeClubId],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      profile,
      adminClubs,
      familyClubs,
      activeClub,
      isAdmin: adminClubs.length > 0,
      isParent: familyClubs.length > 0,
      activeSpace,
      setActiveClubId,
      setActiveSpace,
      signIn,
      signInWithGoogle,
      signUp,
      logout,
      refreshProfile,
    }),
    [
      status,
      user,
      profile,
      adminClubs,
      familyClubs,
      activeClub,
      activeSpace,
      setActiveClubId,
      setActiveSpace,
      signIn,
      signInWithGoogle,
      signUp,
      logout,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Accède au contexte Auth du portail. */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth doit être utilisé dans AuthProvider");
  }
  return ctx;
}
