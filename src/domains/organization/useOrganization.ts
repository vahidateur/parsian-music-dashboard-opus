/**
 * View-facing hook for the academy's rules.
 *
 * Read-through on the global data version, like every other configuration value:
 * when a rule changes — here, in another tab, or through a restored backup — the
 * surfaces that quote it re-read instead of showing a number that stopped being
 * true. That matters more than usual for rules, because a panel that says "the
 * free-cancellation window is 24 hours" while the schedule behaves as if it were
 * 48 is not a stale label, it is a promise the product is breaking.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiErrorFromThrown, type ApiError } from "@/api/errors";
import { getOrganizationRepository } from "@/domains/registry";
import { useDataVersion } from "@/domains/shared/dataVersion";
import type { OrganizationRepository } from "./repository";
import {
  DEFAULT_ORGANIZATION_SETTINGS,
  type OrganizationSettings,
  type UpdateOrganizationInput,
} from "./types";

export interface OrganizationState {
  settings: OrganizationSettings;
  loading: boolean;
  error: ApiError | null;
  saving: boolean;
  update: (input: UpdateOrganizationInput) => Promise<ApiError | null>;
  reload: () => void;
}

export function useOrganization(repository?: OrganizationRepository): OrganizationState {
  const repo = useMemo(() => repository ?? getOrganizationRepository(), [repository]);
  const dataVersion = useDataVersion();
  const [settings, setSettings] = useState<OrganizationSettings>(DEFAULT_ORGANIZATION_SETTINGS);
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
      .get(controller.signal)
      .then((value) => {
        if (!alive.current || controller.signal.aborted) return;
        setSettings(value);
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

  const update = useCallback(
    async (input: UpdateOrganizationInput): Promise<ApiError | null> => {
      setSaving(true);
      try {
        const saved = await repo.update(input);
        if (alive.current) {
          setSettings(saved);
          setError(null);
        }
        return null;
      } catch (cause) {
        const normalized = apiErrorFromThrown(cause);
        if (alive.current) setError(normalized);
        return normalized;
      } finally {
        if (alive.current) setSaving(false);
      }
    },
    [repo],
  );

  return useMemo(
    () => ({ settings, loading, error, saving, update, reload }),
    [settings, loading, error, saving, update, reload],
  );
}

/*
  The derived answers — `workingWindow`, `isClosedWeekday`, `isInsideWorkingHours`
  — live in `./rules`, a pure module with no React in it, because the scheduling
  engine reads them too and a repository must not import a hook. They are
  re-exported here so a view that already has the state can ask the question
  without a second import path.
*/
export { isClosedWeekday, isInsideWorkingHours, schedulingRules, workingWindow } from "./rules";
