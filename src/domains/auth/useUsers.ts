import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { getUserRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import type { UserRepository } from "./repository";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "./types";

/**
 * The outcome of one write: either the record as it was persisted, or the
 * refusal. A mutation that only answered "error or nothing" forced callers to
 * re-read the list to learn what they had just written — which is how a dialog
 * ends up confirming a save it cannot describe.
 */
export interface MutationResult<T> {
  error: ApiError | null;
  value?: T;
}

export interface UsersState {
  users: AuthUser[];
  loading: boolean;
  error: ApiError | null;
  saving: boolean;
  create: (input: CreateUserInput) => Promise<MutationResult<AuthUser>>;
  update: (id: string, input: UpdateUserInput) => Promise<MutationResult<AuthUser>>;
  setStatus: (id: string, status: AuthUser["status"]) => Promise<MutationResult<AuthUser>>;
  remove: (id: string) => Promise<MutationResult<void>>;
  /** Writes the account's passphrase — a credential verb, never a record field. */
  setPassword: (id: string, passphrase: string) => Promise<MutationResult<void>>;
  /** Whether this account signs in with its own passphrase. */
  hasOwnPassword: (id: string) => Promise<boolean>;
  reload: () => void;
}

/** View-facing hook for user administration. Never touches the store directly. */
export function useUsers(repository?: UserRepository): UsersState {
  const repo = useMemo(() => repository ?? getUserRepository(), [repository]);
  /*
    The list follows every persisted write, not just its own. An account linked to
    a teacher record is renamed when that teacher is renamed (one person, one
    name), and a panel that only refreshed on its own mutations would keep
    showing the old name next to the new one — which is exactly the
    "these two screens disagree" defect this hook is now part of fixing.
  */
  const dataVersion = useDataVersion();
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const [nonce, setNonce] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    repo
      .list(controller.signal)
      .then((page) => {
        if (!alive.current || controller.signal.aborted) return;
        setUsers(page.data);
        setError(null);
      })
      .catch((cause: unknown) => {
        const normalized = apiErrorFromThrown(cause);
        if (!alive.current || normalized.kind === "cancelled") return;
        setError(normalized);
      })
      .finally(() => {
        if (alive.current && !controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [repo, nonce, dataVersion]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /** Runs a mutation, returning the persisted value or the refusal — never throws. */
  const run = useCallback(
    async <T,>(op: () => Promise<T>): Promise<MutationResult<T>> => {
      setSaving(true);
      try {
        const value = await op();
        if (alive.current) reload();
        return { error: null, value };
      } catch (cause) {
        const normalized = apiErrorFromThrown(cause);
        if (alive.current) setError(normalized);
        return { error: normalized };
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [reload],
  );

  return {
    users,
    loading,
    error,
    saving,
    reload,
    create: (input) => run(() => repo.create(input)),
    update: (id, input) => run(() => repo.update(id, input)),
    setStatus: (id, status) => run(() => repo.update(id, { status })),
    remove: (id) => run(() => repo.delete(id)),
    setPassword: (id, passphrase) => run(() => repo.setPassword(id, passphrase)),
    hasOwnPassword: (id) => repo.hasOwnPassword(id).catch(() => false),
  };
}
