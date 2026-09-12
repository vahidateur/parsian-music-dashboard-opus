/**
 * The single source of truth for instruments.
 *
 * WHY THIS FILE EXISTS
 *
 * Instruments used to be a closed TypeScript union (`"piano" | "guitar" | …`)
 * plus an exhaustive `instrumentLabel` map in `@/data/academy`. That made it
 * impossible for an academy to define its own instrument at runtime, which is
 * a real product requirement. Instruments are now rows owned by
 * `InstrumentRepository`.
 *
 * That creates one friction point: the repository is async, but ~60 call sites
 * need a *synchronous* Persian label while rendering a table cell, building a
 * CSV row, or formatting a search result. `instrumentName()` solves that with
 * a read-through cache of the instruments collection.
 *
 * This is NOT a second state store (§18):
 *
 *   - The repository remains the only writer. Nothing mutates this cache
 *     directly.
 *   - The cache is a projection of exactly one collection, refreshed from the
 *     repository and invalidated by the same global `dataVersion` counter
 *     every other domain uses.
 *   - It holds no state that cannot be rebuilt by re-reading the repository.
 *
 * Components that must re-render when an instrument is renamed should use
 * `useInstrumentCatalog()`, which subscribes properly. `instrumentName()` is
 * for the render-time and service-layer lookups where a hook is not available.
 */
import { useSyncExternalStore } from "react";
import type { InstrumentRecord } from "./types";

/* ------------------------------------------------------------------ */
/* Seeded definitions — the canonical starting set                     */
/* ------------------------------------------------------------------ */

/**
 * The six instruments the academy ships with.
 *
 * Their ids are the former union members (`piano`, `violin`, …). This is load
 * bearing: every existing student, teacher, class and resource row stores
 * `instrument: "violin"`, and every previously exported CSV and saved backup
 * contains those strings. Changing them would orphan all of that data.
 *
 * New instruments created at runtime get generated ids and are in every other
 * respect equal to these.
 */
export const SEEDED_INSTRUMENTS: readonly InstrumentRecord[] = [
  {
    id: "piano",
    slug: "piano",
    name: "پیانو",
    description: "ساز کلیدی؛ پایهٔ هارمونی و تئوری موسیقی.",
    active: true,
    sortOrder: 1,
  },
  {
    id: "guitar",
    slug: "guitar",
    name: "گیتار",
    description: "ساز زهی مضرابی؛ کلاسیک، پاپ و فلامنکو.",
    active: true,
    sortOrder: 2,
  },
  {
    id: "voice",
    slug: "voice",
    name: "آواز",
    description: "آموزش آواز، تنفس و تربیت شنوایی.",
    active: true,
    sortOrder: 3,
  },
  {
    id: "violin",
    slug: "violin",
    name: "ویولن",
    description: "ساز زهی آرشه‌ای؛ ستون ارکستر زهی.",
    active: true,
    sortOrder: 4,
  },
  {
    id: "drums",
    slug: "drums",
    name: "درامز",
    description: "ساز کوبه‌ای؛ ریتم و هماهنگی گروهی.",
    active: true,
    sortOrder: 5,
  },
  {
    id: "theory",
    slug: "theory",
    name: "تئوری",
    description: "تئوری موسیقی، سلفژ و دیکتهٔ موسیقی.",
    active: true,
    sortOrder: 6,
  },
];

/** Ids of the seeded set, for tests and migration guards. */
export const SEEDED_INSTRUMENT_IDS: readonly string[] = SEEDED_INSTRUMENTS.map((i) => i.id);

/* ------------------------------------------------------------------ */
/* Read-through cache                                                  */
/* ------------------------------------------------------------------ */

/**
 * Starts as the seeded set so the very first synchronous render — before any
 * repository read resolves — shows real Persian names rather than raw ids.
 */
let catalog: readonly InstrumentRecord[] = SEEDED_INSTRUMENTS;
let byId = new Map(SEEDED_INSTRUMENTS.map((i) => [i.id, i]));

const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* one broken subscriber must not stop the rest */
    }
  });
}

/**
 * Replaces the cache with the authoritative rows.
 *
 * Called by `useInstrumentCatalog` after each repository read and by the demo
 * lifecycle after a reset/restore. Idempotent: an identical list is ignored so
 * subscribers are not woken for nothing.
 */
export function setInstrumentCatalog(records: readonly InstrumentRecord[]): void {
  if (records.length === catalog.length && records.every((r, i) => r === catalog[i])) return;
  catalog = [...records].sort((a, b) => a.sortOrder - b.sortOrder);
  byId = new Map(catalog.map((i) => [i.id, i]));
  emit();
}

/** Restores the seeded set. Used when the demo data is reset. */
export function resetInstrumentCatalog(): void {
  catalog = SEEDED_INSTRUMENTS;
  byId = new Map(SEEDED_INSTRUMENTS.map((i) => [i.id, i]));
  emit();
}

/** Current snapshot. Stable identity between changes, safe for `useSyncExternalStore`. */
export function getInstrumentCatalog(): readonly InstrumentRecord[] {
  return catalog;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/* ------------------------------------------------------------------ */
/* Lookups                                                             */
/* ------------------------------------------------------------------ */

/**
 * The Persian display name for an instrument id.
 *
 * Falls back to the id itself for an unknown instrument. That is deliberate:
 * a record referencing a deleted instrument, or a row from a newer backup,
 * should degrade to a readable token rather than render "undefined" or throw
 * in the middle of a table.
 */
export function instrumentName(id: string | undefined): string {
  if (!id) return "—";
  return byId.get(id)?.name ?? id;
}

/** The full record, when more than the name is needed. */
export function findInstrument(id: string | undefined): InstrumentRecord | undefined {
  return id ? byId.get(id) : undefined;
}

/** Whether an id resolves to a known instrument. */
export function isKnownInstrument(id: string): boolean {
  return byId.has(id);
}

/* ------------------------------------------------------------------ */
/* React binding                                                       */
/* ------------------------------------------------------------------ */

/**
 * Subscribes to the catalogue.
 *
 * Use this wherever instruments are *listed* (pickers, filter chips) or where
 * a rename must repaint immediately. Refreshing the cache from the repository
 * is done by `useInstruments`, which every such screen already mounts.
 */
export function useInstrumentCatalog(): readonly InstrumentRecord[] {
  return useSyncExternalStore(subscribe, getInstrumentCatalog, getInstrumentCatalog);
}

/** Convenience: a stable name resolver that re-renders on catalogue changes. */
export function useInstrumentName(): (id: string | undefined) => string {
  useInstrumentCatalog();
  return instrumentName;
}
