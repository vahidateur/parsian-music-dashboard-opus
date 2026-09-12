import { useCallback, useEffect, useState } from "react";
import { demoStore } from "@/services/demoStore";
import {
  initializeDemoEnvironment,
  initializeEmptyEnvironment,
  isDemoEnvironment,
  persistLifecycleAdoption,
  readLifecycleState,
} from "./lifecycle";
import type { DataLifecycleState } from "./types";

/**
 * React binding for the data lifecycle.
 *
 * Views and the application shell talk to the lifecycle through this hook only:
 * it is the seam that keeps `localStorage`, the marker key and the store out of
 * the component layer, exactly as domain hooks keep the DemoStore out of views.
 */

export interface DataLifecycleController {
  /** `uninitialized` until an explicit choice has been made. */
  state: DataLifecycleState;
  /** Set when a choice was refused because an environment already exists. */
  notice: string | null;
  chooseEmpty: () => void;
  chooseDemo: () => void;
}

export function useDataLifecycle(): DataLifecycleController {
  // A pure read during render: no seeding, no adoption, no write.
  const [state, setState] = useState<DataLifecycleState>(() => readLifecycleState());
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    // A dataset that predates the marker is adopted ONCE, here at the lifecycle
    // boundary — not during render and never by a repository read. See
    // `readLifecycleState` for why adoption resolves to DEMO.
    setState(persistLifecycleAdoption());
    // Any later write (reset, clear, restore, uninitialize) re-reads the state,
    // so the gate and every demo-only affordance stay in step with persistence.
    return demoStore.subscribe(() => setState(readLifecycleState()));
  }, []);

  const choose = useCallback((mode: "empty" | "demo") => {
    const result = mode === "empty" ? initializeEmptyEnvironment() : initializeDemoEnvironment();
    setNotice(result.ok ? null : result.message);
    setState(readLifecycleState());
  }, []);

  const chooseEmpty = useCallback(() => choose("empty"), [choose]);
  const chooseDemo = useCallback(() => choose("demo"), [choose]);

  return { state, notice, chooseEmpty, chooseDemo };
}

/**
 * Whether demo-only UI applies (demo notes, demo hints).
 *
 * Subscribes to persistence so a reset/restore that changes the environment's
 * kind updates the affordances without a reload.
 */
export function useIsDemoEnvironment(): boolean {
  const [demo, setDemo] = useState<boolean>(() => isDemoEnvironment());

  useEffect(() => {
    setDemo(isDemoEnvironment());
    return demoStore.subscribe(() => setDemo(isDemoEnvironment()));
  }, []);

  return demo;
}
