import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { clearAttempts, recordFailure } from "@/security/loginThrottle";
import { SESSION_TTL_MS } from "@/domains/auth/demoAuthRepository";
import { anchorSessionClock, clearSessionClock, resetSessionClock } from "@/security/useIdleTimeout";
import { getAuthRepository } from "@/domains/registry";
import { can, canAccessView, canAll, canAny, type Permission } from "./permissions";
import type { AuthRepository } from "./repository";
import type { AuthStatus, LoginInput, Session } from "./types";
import type { ViewId } from "@/data/academy";

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
  pending: boolean;
  login: (input: LoginInput) => Promise<boolean>;
  logout: () => Promise<void>;
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
  const [pending, setPending] = useState(false);
  const mounted = useRef(true);

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
      .restore()
      .then((restored) => {
        if (!active) return;
        if (restored) {
          // Re-anchor the absolute clock to the token's own expiry. Without
          // this, clearing localStorage would hand a still-valid session a
          // fresh absolute lifetime — the ceiling would be resettable by the
          // party it is meant to constrain.
          anchorSessionClock(restored.expiresAt, SESSION_TTL_MS);
        }
        setSession(restored);
        setStatus(restored ? "authenticated" : "unauthenticated");
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setStatus("unauthenticated");
      });
    return () => {
      active = false;
    };
  }, [repo]);

  const login = useCallback(
    async (input: LoginInput): Promise<boolean> => {
      setPending(true);
      setError(null);
      try {
        const next = await repo.login(input);
        if (!mounted.current) return true;
        // A fresh clock on every sign-in: a new session must not inherit the
        // previous one's remaining absolute lifetime.
        resetSessionClock();
        clearAttempts();
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

  const logout = useCallback(async () => {
    try {
      await repo.logout();
    } finally {
      clearSessionClock();
      if (mounted.current) {
        setSession(null);
        setStatus("unauthenticated");
        setError(null);
      }
    }
  }, [repo]);

  const permissions = useMemo(() => session?.permissions ?? [], [session]);
  const holder = useMemo(() => ({ permissions }), [permissions]);

  const value = useMemo<AuthState>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      permissions,
      error,
      pending,
      login,
      logout,
      clearError: () => setError(null),
      can: (permission) => can(holder, permission),
      canAny: (list) => canAny(holder, list),
      canAll: (list) => canAll(holder, list),
      canAccess: (view) => canAccessView(holder, view),
    }),
    [status, session, permissions, error, pending, login, logout, holder],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

/** Convenience for conditional rendering of permission-gated controls. */
export function useCan(permission: Permission): boolean {
  return useAuth().can(permission);
}
