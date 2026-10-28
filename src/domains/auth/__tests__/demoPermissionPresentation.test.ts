/**
 * Demo capability must not be offered by the production-facing product.
 *
 * WHY THIS FILE EXISTS
 *
 * DECISIONS §2 keeps the demo composition a first-class environment, and §4A of
 * the pre-main consolidation requires that demo is not part of the
 * production-facing product. Those are two different questions about two
 * different artifacts, and conflating them is how either gets broken:
 *
 *   - the DEMO composition must keep the demo capability (it is the product's
 *     demonstrable-with-no-backend build, and the delivery/lock lifecycle);
 *   - the CLIENT composition must not present demo anything.
 *
 * The UI half of that boundary is already physical: `targetFeatures.client.tsx`
 * returns `null` for `SettingsFeatures`, so `DemoDataPanel` and
 * `ProductionDeliveryGate` cannot render there — and `bundleBoundary.test.ts`
 * proves against the real `dist/client` output that the demo modules and their
 * marker strings are absent from every chunk.
 *
 * What remained was the PERMISSION VOCABULARY. `demo.manage` authorizes the demo
 * dataset's service layer, so it must stay in the vocabulary — but the role
 * editor is shared by both compositions, and it was offering an administrator a
 * «مدیریت دادهٔ نمایشی» checkbox in the client build, where there is no demo
 * dataset to manage. That is a forbidden control exposed (M2). These cases pin
 * the rule that fixes it, in both directions.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEMO_ONLY_PERMISSIONS,
  PERMISSIONS,
  isDemoOnlyPermission,
  permissionsForComposition,
} from "@/domains/auth/permissions";
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/domains/auth/useRoles";

describe("demo-only permissions are withheld from a non-demo composition", () => {
  it("names demo.manage as the only demo-only permission", () => {
    // If a second demo-only id ever appears, this assertion is the place the
    // change is noticed — the filtering rule below then already covers it.
    expect([...DEMO_ONLY_PERMISSIONS]).toEqual(["demo.manage"]);
    expect(isDemoOnlyPermission("demo.manage")).toBe(true);
    expect(isDemoOnlyPermission("library.write")).toBe(false);
  });

  it("keeps every non-demo permission unchanged in the client composition", () => {
    const client = permissionsForComposition(PERMISSIONS, false);
    expect(client).not.toContain("demo.manage");
    // Nothing else is dropped, and no id is invented.
    expect(client).toHaveLength(PERMISSIONS.length - DEMO_ONLY_PERMISSIONS.length);
    for (const id of client) expect(id).not.toBe("demo.manage");
    expect(new Set(client)).toEqual(
      new Set(PERMISSIONS.filter((p) => p !== "demo.manage")),
    );
  });

  it("offers demo.manage in the demo composition", () => {
    // The other direction: an over-eager filter would silently remove a
    // capability the demo build genuinely has.
    expect(permissionsForComposition(PERMISSIONS, true)).toEqual([...PERMISSIONS]);
  });

  it("does not mutate the list it is given", () => {
    const before = [...PERMISSIONS];
    permissionsForComposition(PERMISSIONS, false);
    expect([...PERMISSIONS]).toEqual(before);
  });

  it("keeps demo.manage in the editor's own grouping and labels", () => {
    // The id stays fully described — only its presentation is filtered, at the
    // point of rendering, so the vocabulary remains one complete matrix.
    const grouped = PERMISSION_GROUPS.flatMap((group) => group.permissions);
    expect(grouped).toContain("demo.manage");
    expect(PERMISSION_LABELS["demo.manage"]).toBeTruthy();
    // And every id in the editor is a real id, so the editor cannot invent one.
    for (const id of grouped) expect(PERMISSIONS).toContain(id);
  });

  it("gates the editor on the composition, not on a runtime lock", () => {
    // The source assertion matters because the failure it prevents is silent:
    // `isDemoCapabilityAvailable()` answers "has delivery happened", which is
    // TRUE in a fresh client build, so using it here would re-expose the
    // checkbox in the one build that must not show it.
    const source = readFileSync(
      join(process.cwd(), "src/components/settings/UsersPanel.tsx"),
      "utf8",
    );
    expect(source).toContain('permissionsForComposition(group.permissions, isDemoMode())');
    expect(source).toContain('from "@/api/config"');
    expect(source).toContain("visibleGroups.map");
    expect(source).not.toContain("isDemoCapabilityAvailable");
  });
});
