/**
 * Aggregations over live domain rows, where "no rows" is a real state.
 *
 * WHY THIS EXISTS
 *
 * An average or a ratio over an EMPTY collection is not `0` — it is undefined.
 * Written inline the way views naturally write it,
 *
 * ```ts
 * rows.reduce((a, b) => a + b.value, 0) / rows.length   // 0 / 0 → NaN
 * Math.max(...rows.map((r) => r.value))                 // Math.max() → -Infinity
 * ```
 *
 * both evaluate happily and hand `NaN`/`-Infinity` to the formatter, which is
 * how an environment that simply has no records yet ends up displaying «NaN٪»
 * next to a correct count of «۰».
 *
 * These helpers return `number | null` instead, so "there is nothing to
 * aggregate" becomes an explicit value the type system carries to the call site
 * and the formatter renders as the honest «—». The empty case is then decided
 * once, at the computation boundary, rather than being patched at every call
 * site with `|| 0` — which would report a fabricated 0٪ as though it were data.
 */

/**
 * Arithmetic mean of a numeric projection over `rows`, or `null` when there is
 * nothing to average.
 *
 * Rounding is deliberately left to the formatter: a mean is a real number, and
 * `faNum`/`faPercent` already apply the display precision.
 */
export function meanOf<T>(rows: readonly T[], project: (row: T) => number): number | null {
  if (rows.length === 0) return null;
  let sum = 0;
  for (const row of rows) sum += project(row);
  return sum / rows.length;
}

/**
 * `part` as a percentage of `whole`, or `null` when `whole` is not a usable
 * denominator (zero seats, zero capacity, nothing enrolled yet).
 *
 * A capacity of zero is not "0% full" — there is nothing that could be full,
 * and saying otherwise reports a measurement that never happened.
 */
export function ratioPct(part: number, whole: number): number | null {
  if (!(whole > 0)) return null;
  return (part / whole) * 100;
}

/**
 * The row with the largest projected value, or `null` when no row qualifies.
 *
 * `qualifies` keeps "nothing to report" out of the result: an environment with
 * rows that all have zero waitlisted students has no "most waitlisted" class,
 * and a UI that names one would be naming a record that does not exist.
 */
export function topBy<T>(
  rows: readonly T[],
  project: (row: T) => number,
  qualifies: (row: T) => boolean = () => true,
): T | null {
  let best: T | null = null;
  let bestValue = -Infinity;
  for (const row of rows) {
    if (!qualifies(row)) continue;
    const value = project(row);
    if (value > bestValue) {
      best = row;
      bestValue = value;
    }
  }
  return best;
}
