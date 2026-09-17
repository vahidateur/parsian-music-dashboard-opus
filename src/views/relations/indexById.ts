/**
 * `id → row` indexes for the M7 relation surfaces.
 *
 * WHAT IT IS FOR
 *
 * Every relation the M7 surfaces display ends in the same step: a repository row
 * carries a foreign key (`student.teacherId`, `class.roomId`, `session.classId`,
 * `enrollment.studentId`) and a second repository read owns the entity it points
 * at. Resolving those one row at a time inside a render map is O(rows × lookups)
 * — and it invites the fixture resolvers back in (`teacherById`, `classById`, …)
 * because they are exactly the shape that is otherwise missing.
 *
 * So: build the index ONCE per loaded page, then read from it.
 *
 *   const teachersById = useMemo(() => indexById(teachers), [teachers]);
 *   …
 *   teachersById.get(student.teacherId)?.name ?? NO_DATA
 *
 * Hoisting is the caller's job on purpose. Building an index inside JSX or inside
 * a `map` callback rebuilds it for every row, which is the cost this helper
 * exists to avoid.
 *
 * ONE PRIMITIVE, NOT FOUR WRAPPERS
 *
 * ID → teacher, ID → room, ID → class and ID → student are the same pure
 * operation over rows with an `id`. Typed wrappers (`teacherIndex`, `roomIndex`,
 * `classIndex`, `studentIndex`) would add no behaviour, and naming `Teacher`,
 * `Room`, `AcademyClass` and `Student` in their signatures would pull three types
 * out of `@/data/records` — the module this layer must not reach into. Moving
 * those types into their owning domains is the M10 fixture/type/seed separation,
 * not M7's, so this file stays generic and fixture-free.
 *
 * A MISSING ID IS NOT AN ERROR. A relation may legitimately point at a row
 * outside the loaded page. `.get()` answers `undefined` for that, and the honest
 * rendering is `NO_DATA` («—» from `@/lib/format`) — never an invented name.
 */

/**
 * Indexes rows by their own `id`.
 *
 * - Read-only by type: callers must not mutate the result.
 * - Rows are stored by reference, so a resolved row can be compared with `===`
 *   against a row from the same page.
 * - Ids are used exactly as they appear on the row. A repository page has unique
 *   ids; should a duplicate ever appear, the LAST row wins (Map insertion
 *   order). That is deterministic and asserted by test, so the behaviour is a
 *   contract rather than an accident.
 * - The input array is never modified.
 */
export function indexById<T extends { id: string }>(rows: readonly T[]): ReadonlyMap<string, T> {
  const index = new Map<string, T>();
  for (const row of rows) index.set(row.id, row);
  return index;
}
