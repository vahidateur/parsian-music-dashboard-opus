/**
 * The frontend and backend permission models must be the SAME model.
 *
 * WHY THIS FILE EXISTS
 *
 * `src/domains/auth/permissions.ts` and `backend/config/permissions.php` are two
 * hand-maintained copies of one contract: the TS module is the UX layer's copy,
 * the PHP config is the server's. Nothing forced them to agree, and they did
 * not: DECISIONS §29 authorized `progress.read` / `progress.write` and the
 * backend received both (vocabulary 25, `progress.read` in `$readOnlyCore`,
 * `progress.write` on manager and teacher) while the frontend kept the old 23-id
 * vocabulary and the old matrix. The server could therefore answer a request the
 * client had no word for — a silent divergence, not a visible failure.
 *
 * This test is the missing guard. It reads the SHIPPED PHP config and asserts
 * both halves of the model match: the vocabulary and the per-role defaults. It
 * is deliberately a comparison against the real file rather than a second
 * hand-written expectation, because a hand-written list is exactly the artifact
 * that drifted in the first place.
 *
 * WHAT IT DOES NOT DO: it does not import PHP or execute it (no PHP runtime is
 * available in this environment). It parses the config's array literal — which
 * is plain, quoted data — and compares VALUES. If the PHP file is ever
 * restructured into computed logic, this parser must be revisited rather than
 * the assertions relaxed.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PERMISSIONS, ROLES, permissionsForRole, rolePermissions, type RoleId } from "@/domains/auth/permissions";

const PHP_PATH = join(process.cwd(), "backend/config/permissions.php");
const php = readFileSync(PHP_PATH, "utf8");

/** The quoted `<domain>.<action>` ids inside one PHP array block, in order. */
function quotedIds(block: string): string[] {
  return [...block.matchAll(/'([a-z]+\.[a-z]+)'/g)].map((m) => m[1]);
}

/** The body of a top-level `$name = [ ... ];` array literal. */
function phpArray(name: string): string {
  const match = php.match(new RegExp(`\\$${name}\\s*=\\s*\\[([\\s\\S]*?)\\n\\];`));
  if (!match) throw new Error(`backend/config/permissions.php: could not find $${name}`);
  return match[1];
}

const phpVocabulary = quotedIds(phpArray("vocabulary"));
const phpReadOnlyCore = quotedIds(phpArray("readOnlyCore"));

/**
 * The `'defaults' => [ ... ]` map, one entry per role.
 *
 * A role is either the bare `$vocabulary` (administrator) or a bracket block
 * that may reference `...$readOnlyCore`. The spread is expanded here, the same
 * way PHP would, so the comparison is against the effective grant set.
 */
function phpRoleDefaults(): Record<string, string[]> {
  const section = php.slice(php.indexOf("'defaults' => ["));
  const out: Record<string, string[]> = {};
  const entry = /'(administrator|manager|teacher|staff|accountant)'\s*=>\s*(\$vocabulary|\[([\s\S]*?)\n {8}\])/g;
  for (const match of section.matchAll(entry)) {
    const [, role, whole, body] = match;
    if (whole === "$vocabulary") {
      out[role] = [...phpVocabulary];
      continue;
    }
    const ids = quotedIds(body);
    out[role] = body.includes("...$readOnlyCore") ? [...phpReadOnlyCore, ...ids] : ids;
  }
  return out;
}

const phpDefaults = phpRoleDefaults();

/** Order-insensitive comparison, so neither file dictates the other's ordering. */
const asSet = (values: readonly string[]): Set<string> => new Set(values);

describe("permission parity — frontend vs backend/config/permissions.php", () => {
  it("parses the shipped PHP config rather than assuming its shape", () => {
    // A guard on the guard: if the parser silently matched nothing, every
    // comparison below would pass for the wrong reason.
    expect(phpVocabulary.length).toBeGreaterThan(0);
    expect(phpReadOnlyCore.length).toBeGreaterThan(0);
    expect(Object.keys(phpDefaults).sort()).toEqual([...ROLES].sort());
    for (const ids of Object.values(phpDefaults)) expect(ids.length).toBeGreaterThan(0);
  });

  it("declares exactly the same permission vocabulary", () => {
    expect(asSet(phpVocabulary)).toEqual(asSet(PERMISSIONS));
    // Same size AND same members, so a duplicated id cannot hide a missing one.
    expect(phpVocabulary.length).toBe(PERMISSIONS.length);
  });

  it("grants every role exactly the permissions the backend grants it", () => {
    for (const role of ROLES) {
      expect(asSet(permissionsForRole(role)), `role ${role}`).toEqual(asSet(phpDefaults[role]));
      expect(permissionsForRole(role).length, `role ${role} (duplicate id?)`).toBe(phpDefaults[role].length);
    }
  });

  it("keeps the shipped role defaults identical to the live resolution", () => {
    // `permissionsForRole` falls back to `rolePermissions` when no policy record
    // exists; a divergence between them would make an unedited role behave
    // differently from its own documented default.
    for (const role of ROLES) {
      expect(asSet(rolePermissions[role]), `role ${role}`).toEqual(asSet(phpDefaults[role]));
    }
  });

  it("holds Instruments exactly as DECISIONS §33 authorizes it", () => {
    expect(phpReadOnlyCore).toContain("instruments.read");
    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: true },
      teacher: { read: true, write: false },
      staff: { read: true, write: false },
      accountant: { read: true, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("instruments.read"), `${role} instruments.read`).toBe(expected[role].read);
      expect(granted.includes("instruments.write"), `${role} instruments.write`).toBe(expected[role].write);
    }
  });

  it("holds Rooms exactly as DECISIONS §35 authorizes it", () => {
    expect(phpReadOnlyCore).toContain("rooms.read");
    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: true },
      teacher: { read: true, write: false },
      staff: { read: true, write: false },
      accountant: { read: true, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("rooms.read"), `${role} rooms.read`).toBe(expected[role].read);
      expect(granted.includes("rooms.write"), `${role} rooms.write`).toBe(expected[role].write);
    }
  });

  it("holds Gallery exactly as DECISIONS §36 authorizes it", () => {
    expect(phpReadOnlyCore).toContain("gallery.read");
    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: true },
      teacher: { read: true, write: false },
      staff: { read: true, write: false },
      accountant: { read: false, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("gallery.read"), `${role} gallery.read`).toBe(expected[role].read);
      expect(granted.includes("gallery.write"), `${role} gallery.write`).toBe(expected[role].write);
    }
  });

  it("holds Branding exactly as DECISIONS §38 authorizes it", () => {
    expect(phpReadOnlyCore).toContain("branding.read");
    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: false },
      teacher: { read: true, write: false },
      staff: { read: true, write: false },
      accountant: { read: true, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("branding.read"), `${role} branding.read`).toBe(expected[role].read);
      expect(granted.includes("branding.write"), `${role} branding.write`).toBe(expected[role].write);
    }
  });

  it("holds Learning exactly as DECISIONS §34 authorizes it", () => {
    expect(phpReadOnlyCore).toContain("learning.read");
    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: true },
      teacher: { read: true, write: true },
      staff: { read: true, write: false },
      accountant: { read: false, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("learning.read"), `${role} learning.read`).toBe(expected[role].read);
      expect(granted.includes("learning.write"), `${role} learning.write`).toBe(expected[role].write);
    }
  });

  it("holds Progress exactly as DECISIONS §29 authorizes it", () => {
    // §29 is the decision this whole guard exists for, so its concrete
    // consequence is asserted directly rather than left implicit in the matrix.
    const READ_ONLY_CORE_MEMBERS = ["students.read", "teachers.read", "classes.read", "schedule.read", "library.read"];
    for (const id of READ_ONLY_CORE_MEMBERS) expect(phpReadOnlyCore).toContain(id);
    expect(phpReadOnlyCore).toContain("progress.read");

    const expected: Record<RoleId, { read: boolean; write: boolean }> = {
      administrator: { read: true, write: true },
      manager: { read: true, write: true },
      teacher: { read: true, write: true },
      staff: { read: true, write: false },
      accountant: { read: false, write: false },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("progress.read"), `${role} progress.read`).toBe(expected[role].read);
      expect(granted.includes("progress.write"), `${role} progress.write`).toBe(expected[role].write);
    }
  });

  it("holds Finance exactly as DECISIONS §41 authorizes it", () => {
    // Paying is a desk verb: staff and manager confirm, administrator and
    // accountant do everything, teachers hold nothing. Issuing stays
    // administrator/accountant.
    const expected: Record<RoleId, { read: boolean; write: boolean; pay: boolean }> = {
      administrator: { read: true, write: true, pay: true },
      manager: { read: true, write: false, pay: true },
      teacher: { read: false, write: false, pay: false },
      staff: { read: false, write: false, pay: true },
      accountant: { read: true, write: true, pay: true },
    };
    for (const role of ROLES) {
      const granted = permissionsForRole(role);
      expect(granted.includes("finance.read"), `${role} finance.read`).toBe(expected[role].read);
      expect(granted.includes("finance.write"), `${role} finance.write`).toBe(expected[role].write);
      expect(granted.includes("finance.pay"), `${role} finance.pay`).toBe(expected[role].pay);
    }
  });

  it("holds Gallery details exactly as the §40 follow-up authorizes them", () => {
    // Display-only: teachers open the showcase but see bare photographs.
    // Bytes and metadata stay authorized by gallery.read (§36).
    const expected: Record<RoleId, boolean> = {
      administrator: true,
      manager: true,
      teacher: false,
      staff: true,
      accountant: false,
    };
    for (const role of ROLES) {
      expect(permissionsForRole(role).includes("gallery.details"), `${role} gallery.details`).toBe(expected[role]);
    }
  });

  it("adds no notification or other inventable ids — every PB-3 domain now carries its own", () => {
    // PB-3 has no blocked domain left: §29 lifted Progress, §33 lifted
    // Instruments, §34 lifted Learning, §35 lifted Rooms. PB-5 still stands
    // for notifications.
    for (const id of PERMISSIONS) {
      expect(id, `unexpected id ${id}`).not.toMatch(/^(notifications|media|storage|resource)\./);
    }
  });
});
