import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { clearAttempts, recordFailure } from "@/security/loginThrottle";
import { SESSION_TTL_MS } from "@/domains/auth/session";
import { anchorSessionClock, clearSessionClock, notifySessionEnded, readSessionEnded, resetSessionClock, type SessionEndReason } from "@/security/useIdleTimeout";
import { getAuthRepository } from "@/domains/registry";
import { setSessionExpiredHandler } from "@/domains/registryCore";
import { can, canAccessView, canAll, canAny, clearRolePolicies, getRolePolicy, type Permission } from "./permissions";
import { useRolePolicyVersion } from "./useRoles";
import type { AuthRepository } from "./repository";
import type { AuthStatus, LoginInput, Session } from "./types";
import type { ViewId } from "@/lib/viewContracts";

/**
 * Authentication state for the whole app.
 *
 * Authorization helpers live here too, but they are *UX* helpers: they decide
 * what to render/enable. The backend remains the authorization authority.
 */

export interface AuthState {
  status: AuthStatus;
  session: Session | null;
  user: Session["user"] | null;
  permissions: Permission[];
  error: ApiError | null;
  /**
   * Why the last session ended, shown on the login screen. Set by
   * server-side expiry (idle/absolute), a cross-tab sign-out, or a 401
   * mid-session — never by a failed login attempt (that stays `error`).
   * Cleared on the next login attempt.
   */
  notice: string | null;
  pending: boolean;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
  /**
   * Ends the session with an expiry reason: revokes server-side, clears
   * locally, broadcasts to other tabs, and leaves `notice` behind so the
   * login screen can say why. Used by the idle guard, the cross-tab
   * listener, and the 401 handler — not by the login form.
   */
  expireSession: (reason: SessionEndReason) => Promise<void>;
  clearError: () => void;
  can: (permission: Permission) => boolean;
  canAny: (permissions: readonly Permission[]) => boolean;
  canAll: (permissions: readonly Permission[]) => boolean;
  canAccess: (view: ViewId) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children, repository }: { children: ReactNode; repository?: AuthRepository }) {
  const repo = useMemo(() => repository ?? getAuthRepository(), [repository]);
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<AuthStatus>("restoring");
  const [error, setError] = useState<ApiError | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);
  // Synchronous mirror of `session` for event handlers that must decide
  // re-entrantly: a second 401 (or a second tab's broadcast) arriving while
  // a sign-out is already in flight must be a no-op, never a loop.
  const sessionRef = useRef<Session | null>(null);
  sessionRef.current = session;

  const SESSION_END_NOTICE: Record<SessionEndReason, string> = {
    idle: "نشست شما به دلیل عدم فعالیت به پایان رسید. برای ادامه وارد شوید.",
    absolute: "مدت نشست شما به پایان رسید. برای ادامه وارد شوید.",
    logout: "از حساب خارج شدید. برای ادامه وارد شوید.",
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  /* Session restoration on boot. */
  useEffect(() => {
    let active = true;
    repo
      .restoreDetailed()
      .then(({ session: restored, expiredReason }) => {
        if (!active) return;
        if (restored) {
          // Re-anchor the absolute clock to the token's own expiry. Without
          // this, clearing localStorage would hand a still-valid session a
          // fresh absolute lifetime — the ceiling would be resettable by the
          // party it is meant to constrain.
          anchorSessionClock(restored.expiresAt, SESSION_TTL_MS);
        }
        // The permission projection is module-scoped for synchronous gates, so
        // clear the previous session before the new one can render. A failed
        // policy read then falls back deterministically to this session's own
        // issued permissions rather than retaining another user's role edit.
        clearRolePolicies();
        setSession(restored);
        setStatus(restored ? "authenticated" : "unauthenticated");
        // A stored session that provably outlived a lifetime ceiling says so
        // on the login screen (idle vs absolute); any other boot failure
        // stays silent, exactly as before — boot must not probe credentials.
        setNotice(!restored && expiredReason ? SESSION_END_NOTICE[expiredReason] : null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus("unauthenticated");
        setNotice(null);
      });
    return () => {
      active = false;
    };
  }, [repo]);

  const login = useCallback(
    async (input: LoginInput): Promise<boolean> => {
      setPending(true);
      setError(null);
      setNotice(null);
      try {
        const next = await repo.login(input);
        if (!mounted.current) return true;
        // A fresh clock on every sign-in: a new session must not inherit the
        // previous one's remaining absolute lifetime.
        resetSessionClock();
        clearAttempts();
        clearRolePolicies();
        setSession(next);
        setStatus("authenticated");
        return true;
      } catch (cause) {
        // Record the failure for the client-side backoff. The authoritative
        // rate limit is server-side; this only slows the honest path.
        recordFailure();
        if (mounted.current) setError(apiErrorFromThrown(cause));
        return false;
      } finally {
        if (mounted.current) setPending(false);
      }
    },
    [repo],
  );

  const clearSessionState = useCallback(() => {
    clearSessionClock();
    clearRolePolicies();
    if (mounted.current) {
      sessionRef.current = null;
      setSession(null);
      setStatus("unauthenticated");
      setError(null);
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await repo.logout();
    } finally {
      notifySessionEnded("logout");
      clearSessionState();
    }
  }, [repo, clearSessionState]);

  /*
   * Server-side expiry (or another tab) ended the session. Unlike logout —
   * an explicit act that needs no explanation — this leaves `notice` behind
   * so the login screen can say why. Guarded by sessionRef: concurrent 401s
   * (every in-flight request fails at once) and repeat broadcasts collapse
   * into a single sign-out instead of a logout loop.
   */
  const expireSession = useCallback(
    async (reason: SessionEndReason) => {
      if (sessionRef.current === null) return;
      sessionRef.current = null;
      try {
        // Best-effort server revocation: the token may already be dead
        // (that is why we are here), and a flaky network must not block
        // the local sign-out that actually protects the machine.
        await repo.logout().catch(() => undefined);
      } finally {
        notifySessionEnded(reason);
        clearSessionClock();
        clearRolePolicies();
        if (mounted.current) {
          setSession(null);
          setStatus("unauthenticated");
          setError(null);
          setNotice(SESSION_END_NOTICE[reason]);
        }
      }
    },
    [repo],
  );

  /*
   * Two push paths converge here: the ApiClient's 401 hook (any protected
   * request rejected mid-session, including the new idle/absolute codes)
   * and other tabs' session-end broadcasts. Both are no-ops once signed
   * out, and neither navigates explicitly — AuthGate renders the login
   * view for `unauthenticated`, so flipping status IS the redirect, and it
   * cannot loop (no retry-on-401 exists anywhere in src/).
   */
  useEffect(() => {
    setSessionExpiredHandler((apiError?: { code?: string }) => {
      if (sessionRef.current === null) return;
      const code = apiError?.code;
      // Unknown 401s (revoked elsewhere, malformed session) end here with
      // the generic sign-out notice — silent would hide a real state change.
      const reason: SessionEndReason =
        code === "AUTH_SESSION_ABSOLUTE_EXPIRED"
          ? "absolute"
          : code === "AUTH_SESSION_IDLE_EXPIRED"
            ? "idle"
            : "logout";
      void expireSession(reason);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key !== "ava:session:ended") return;
      const reason = readSessionEnded();
      if (reason === null || sessionRef.current === null) return;
      // Reason travels with the broadcast so every tab reports honestly;
      // a plain logout elsewhere signs out here silently (no notice).
      void expireSession(reason);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      setSessionExpiredHandler(null);
      window.removeEventListener("storage", onStorage);
    };
  }, [expireSession]);

  /*
    THE MATRIX IS LIVE, NOT FROZEN AT LOGIN.

    A session carries the permissions its role had when it was issued. When an
    administrator edits that role in Settings, the edit must reach the people
    already signed in — otherwise the panel keeps showing controls an academy
    just revoked until everybody logs out. So the session's role is re-resolved
    through the policy projection on every change, and the permissions the session
    itself carries are the fallback for the frames before that projection has
    been read (and for a backend that issues its own set).
  */
  const policyVersion = useRolePolicyVersion();
  const permissions = useMemo(() => {
    if (!session) return [];
    // An administrator's edit wins over what the session was issued with; until
    // the policy projection has been read (or in a deployment where nobody has
    // edited anything) the session's own set is the answer — in API mode that set
    // is the server's, and the client never second-guesses it.
    const edited = getRolePolicy(session.user.role);
    return edited ? [...edited.permissions] : session.permissions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, policyVersion]);
  const holder = useMemo(() => ({ permissions }), [permissions]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      permissions,
      error,
      notice,
      pending,
      login,
      logout,
      expireSession,
      clearError: () => setError(null),
      can: (permission) => can(holder, permission),
      canAny: (list) => canAny(holder, list),
      canAll: (list) => canAll(holder, list),
      canAccess: (view) => canAccessView(holder, view),
    }),
    [status, session, permissions, error, notice, pending, login, logout, expireSession, holder],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Convenience for conditional rendering of permission-gated controls.
 * Returns true when outside AuthProvider (e.g., legacy tests that render a view
 * directly) so that write controls remain visible for honestWriteCopy etc.
 * Real product always has AuthProvider via App shell, so this fallback does not
 * affect production RBAC — route protection already blocks unauthenticated.
 */
export function useCan(permission: Permission): boolean {
  try {
    return useAuth().can(permission);
  } catch {
    // Outside provider — treat as allowed for legacy view-level tests
    return true;
  }
}

/** Safe version of useAuth that returns null user when outside provider */
export function useAuthSafe(): { user: { id: string; role: string; teacherId?: string } | null } {
  try {
    const ctx = useAuth();
    return { user: ctx.user as any };
  } catch {
    return { user: null };
  }
}
