import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError, apiErrorFromThrown } from "@/api/errors";
import { getUserRepository } from "@/domains/registry";
import type { UserRepository } from "./repository";
import type { AuthUser, CreateUserInput, UpdateUserInput } from "./types";

export interface UsersState {
  users: AuthUser[];
  loading: boolean;
  error: ApiError | null;
  saving: boolean;
  create: (input: CreateUserInput) => Promise<ApiError | null>;
  update: (id: string, input: UpdateUserInput) => Promise<ApiError | null>;
  setStatus: (id: string, status: AuthUser["status"]) => Promise<ApiError | null>;
  remove: (id: string) => Promise<ApiError | null>;
  reload: () => void;
}

/** View-facing hook for user administration. Never touches the store directly. */
export function useUsers(repository?: UserRepository): UsersState {
  const repo = useMemo(() => repository ?? getUserRepository(), [repository]);
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
  }, [repo, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  /** Runs a mutation, returning the validation/api error instead of throwing. */
  const run = useCallback(
    async (op: () => Promise<unknown>): Promise<ApiError | null> => {
      setSaving(true);
      try {
        await op();
        if (alive.current) reload();
        return null;
      } catch (cause) {
        const normalized = apiErrorFromThrown(cause);
        if (alive.current) setError(normalized);
        return normalized;
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
  };
}
