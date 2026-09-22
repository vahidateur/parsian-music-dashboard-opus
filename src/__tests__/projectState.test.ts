/**
 * The engineering state documents must stay truthful.
 *
 * `docs/engineering/` is how a fresh session — agent or human — recovers context without
 * conversation memory. A recovery document that lies is worse than no document at all: it
 * sends the next reader to a checkpoint that does not exist, or lets a deferred item be
 * reported as finished work.
 *
 * These checks read the real files and the real Git objects, following the two patterns the
 * suite already uses: `privacyPosture.test.ts` (assert against the artifact, not the intent)
 * and `cspCompatibility.test.ts` (`skipIf` when the evidence cannot exist in this
 * environment). Git-dependent checks are skipped, never faked, when there is no Git.
 *
 * Deliberately offline: nothing here contacts the network, so the remote is never queried.
 * PROJECT_STATE.md instructs the reader to verify the remote with `git ls-remote` — that is a
 * human/agent step, not a unit test.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";

const ROOT = process.cwd();
const ENGINEERING = join(ROOT, "docs", "engineering");
const REQUIRED_DOCS = ["PROJECT_STATE.md", "PHASES.md", "DECISIONS.md", "OPEN_ITEMS.md"];

function doc(name: string): string {
  return readFileSync(join(ENGINEERING, name), "utf8");
}

/**
 * Document text with every run of whitespace collapsed to one space.
 *
 * These documents are prose, wrapped at ~100 columns, so a phrase gate written against the
 * literal text breaks whenever a sentence is re-wrapped — a false red that teaches people to
 * delete gates. Phrase assertions go through this; path assertions do not need it, because no
 * path in these documents contains whitespace.
 */
function flat(text: string): string {
  return text.replace(/\s+/g, " ");
}

type GitResult = { status: number; stdout: string; stderr: string };
type GitRunner = (args: string[], input?: string) => GitResult;

// Set these AFTER process.env: even a partial clone must never fetch evidence implicitly.
const OFFLINE_GIT_ENV = {
  ...process.env,
  GIT_NO_LAZY_FETCH: "1",
  GIT_ALLOW_PROTOCOL: "",
  GIT_TERMINAL_PROMPT: "0",
  GIT_OPTIONAL_LOCKS: "0",
  GIT_NO_REPLACE_OBJECTS: "1",
  LC_ALL: "C",
};

const runGit: GitRunner = (args, input) => {
  const result = spawnSync("git", args, {
    cwd: ROOT, encoding: "utf8", env: OFFLINE_GIT_ENV, input, timeout: 10_000,
  });
  if (result.error) throw result.error;
  if (result.status === null) throw new Error(`git ${args.join(" ")} terminated by ${result.signal}`);
  return { status: result.status, stdout: result.stdout.trim(), stderr: result.stderr.trim() };
};

function gitOutput(args: string[], result: GitResult): string {
  if (result.status !== 0) {
    throw new Error(`Unexpected Git error (${result.status}): git ${args.join(" ")}\n${result.stderr}`);
  }
  return result.stdout;
}

function git(...args: string[]): string {
  return gitOutput(args, runGit(args));
}

/** Absence of Git/repository is skippable; permission, corruption and process errors are not. */
const gitAvailable = (() => {
  try {
    const args = ["rev-parse", "--git-dir"];
    const result = runGit(args);
    if (result.status === 128 && /not a git repository/i.test(result.stderr)) return false;
    gitOutput(args, result);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw error;
  }
})();

type Evidence =
  | { kind: "verified" }
  | { kind: "invalid" | "unverifiable"; reason: string };
const VERIFIED: Evidence = { kind: "verified" };

/** Evaluate every dependency before deciding to skip: an unknown must not hide a known failure. */
function combineEvidence(items: Evidence[]): Evidence {
  for (const kind of ["invalid", "unverifiable"] as const) {
    const reasons = items.flatMap((item) => item.kind === kind ? [item.reason] : []);
    if (reasons.length) return { kind, reason: [...new Set(reasons)].join("\n") };
  }
  return VERIFIED;
}

function requireEvidence(context: { skip: (note: string) => unknown }, ...items: Evidence[]): void {
  const result = combineEvidence(items);
  if (result.kind === "invalid") throw new Error(result.reason);
  if (result.kind === "unverifiable") context.skip(`UNVERIFIABLE: ${result.reason}`);
}

/** Real probes by default; only the policy regression cases below supply an in-memory runner. */
function createGitEvidence(run: GitRunner = runGit) {
  const output = (...args: string[]) => gitOutput(args, run(args));
  const optionalConfig = (...args: string[]) => {
    const result = run(["config", ...args]);
    return result.status === 1 && !result.stderr ? "" : gitOutput(["config", ...args], result);
  };
  let checkout: { shallow: boolean; partial: boolean } | undefined;
  function historyState() {
    if (!checkout) {
      const shallow = output("rev-parse", "--is-shallow-repository");
      if (shallow !== "true" && shallow !== "false") throw new Error("Invalid Git shallow-repository response");
      const legacy = optionalConfig("--get", "extensions.partialClone");
      const promisors = optionalConfig("--type=bool", "--get-regexp", "^remote\\..*\\.promisor$");
      checkout = { shallow: shallow === "true", partial: !!legacy || / true$/m.test(promisors) };
    }
    return checkout;
  }

  const types = new Map<string, string>();
  function objectType(sha: string): string {
    if (!types.has(sha)) {
      const args = ["cat-file", "--batch-check=%(objectname) %(objecttype)"];
      const result = run(args, `${sha}\n`);
      const response = gitOutput(args, result);
      // cat-file --batch-check can exit 0 and print "missing" after an object-database error.
      // With LC_ALL=C, these line prefixes are Git error diagnostics, unlike warnings/hints.
      // Reject them before parsing OR caching stdout; an unhealthy lookup is not missing history.
      if (/^(?:error|fatal|BUG):/m.test(result.stderr)) {
        throw new Error(`Git batch lookup reported an error (exit ${result.status}):\n${result.stderr}`);
      }
      const match = /^([0-9a-f]{40}) (commit|tree|blob|tag|missing)$/.exec(response);
      if (!match || match[1] !== sha) throw new Error(`Unexpected cat-file response: ${response}`);
      types.set(sha, match[2]);
    }
    return types.get(sha)!;
  }

  function missingObject(sha: string, expected: string): Evidence {
    const { shallow, partial } = historyState();
    return {
      kind: shallow || partial ? "unverifiable" : "invalid",
      reason: `${sha}: missing ${expected} object in ${shallow || partial ? "shallow/partial" : "complete"} checkout`,
    };
  }

  function object(sha: string, expected = "commit"): Evidence {
    if (!/^[0-9a-f]{40}$/.test(sha)) return { kind: "invalid", reason: `Malformed object SHA: ${sha}` };
    const type = objectType(sha);
    if (type === expected) return VERIFIED;
    if (type !== "missing") return { kind: "invalid", reason: `${sha} is a ${type}, not a ${expected}` };
    return missingObject(sha, expected);
  }

  const headers = new Map<string, { tree: string; parents: string[] }>();
  function header(sha: string) {
    if (!headers.has(sha)) {
      // Raw headers retain real parents even when Git traversal treats a shallow boundary as a root.
      const text = output("cat-file", "-p", sha).split("\n\n")[0];
      const tree = /^tree ([0-9a-f]{40})$/m.exec(text)?.[1];
      const parents = text.split("\n").filter((line) => line.startsWith("parent ")).map((line) => line.slice(7));
      if (!tree || parents.some((parent) => !/^[0-9a-f]{40}$/.test(parent))) {
        throw new Error(`Malformed commit header: ${sha}`);
      }
      headers.set(sha, { tree, parents });
    }
    return headers.get(sha)!;
  }

  function localAncestry(older: string, newer: string): Evidence {
    // Search available parent links for THIS relationship, not for a complete repository.
    // Breadth-first traversal reaches a nearby proof before unrelated older history. A missing
    // side path cannot undo a proven path; an already observed integrity failure still wins.
    const pending = [newer], seen = new Set<string>(), checks: Evidence[] = [];
    for (let index = 0; index < pending.length; index++) {
      const sha = pending[index];
      if (seen.has(sha)) continue;
      seen.add(sha);
      if (sha === older) return combineEvidence(checks.filter((check) => check.kind === "invalid"));
      const present = object(sha);
      checks.push(present);
      if (present.kind === "verified") pending.push(...header(sha).parents);
    }
    const complete = combineEvidence(checks);
    return complete.kind === "verified"
      ? { kind: "invalid", reason: `${older} is not an ancestor of ${newer} (complete relevant history)` }
      : complete;
  }

  function ancestry(older: string, newer: string): Evidence {
    const olderEvidence = object(older), newerEvidence = object(newer);
    const endpoints = combineEvidence([olderEvidence, newerEvidence]);
    if (endpoints.kind === "invalid" || newerEvidence.kind !== "verified") return endpoints;
    if (endpoints.kind === "unverifiable") {
      // Missing older-object evidence must not hide non-ancestry proven by complete newer history.
      // Keep both results: reaching a missing target cannot waive its existence/type validation.
      return combineEvidence([endpoints, localAncestry(older, newer)]);
    }
    if (older === newer) return VERIFIED;
    // Promisor traversal may otherwise fail on an unrelated missing parent. Local commit
    // headers can prove the path without asking Git to walk beyond either endpoint.
    if (historyState().partial) return localAncestry(older, newer);
    const args = ["merge-base", "--is-ancestor", older, newer];
    const result = run(args);
    if (result.status === 0) return VERIFIED;
    if (result.status !== 1 || result.stderr) gitOutput(args, result); // errors are not non-ancestry
    // A shallow graft can hide parent links whose objects are nevertheless available locally.
    return localAncestry(older, newer);
  }

  const directoryEntries = new Map<string, string | null>();
  function childTree(tree: string | null, name: string): { tree: string | null; evidence: Evidence } {
    if (tree === null) return { tree: null, evidence: VERIFIED }; // known absence, not unavailable data
    const present = object(tree, "tree");
    if (present.kind !== "verified") return { tree: null, evidence: present };
    const key = `${tree}:${name}`;
    if (!directoryEntries.has(key)) {
      // Read one immediate path component, never recurse into unrelated or target descendants.
      const entry = output("ls-tree", "-z", "--format=%(objecttype) %(objectname)%x09%(path)", tree, "--", name);
      const match = /^(tree|blob|commit) ([0-9a-f]{40})\t([^\0]+)\0$/.exec(entry);
      if (entry && (!match || match[3] !== name)) throw new Error(`Unexpected ls-tree response for ${tree}/${name}`);
      // A file, symlink or gitlink at this component has no paths underneath docs/engineering/.
      directoryEntries.set(key, match?.[1] === "tree" ? match[2] : null);
    }
    return { tree: directoryEntries.get(key)!, evidence: VERIFIED };
  }

  function documentationRejection(sha: string, tree: string, parentTrees: readonly (string | null)[]):
    { kind: "invalid"; reason: string } | undefined {
    // Failure-only proof: equal root/docs/engineering IDs mean the target cannot have changed
    // against this parent. Combined git-show paths must differ from EVERY parent. A true root
    // compares against known absence (null), just as git show compares it against an empty tree.
    const components = ["docs", "engineering"];
    for (const parentTree of parentTrees) {
      let current: string | null = tree;
      let previous: string | null = parentTree;
      for (let depth = 0; depth <= components.length; depth++) {
        if (current === previous) return { kind: "invalid", reason: `${sha} did not change docs/engineering/` };
        if (depth === components.length) break;
        const entries: ReturnType<typeof childTree>[] = [
          childTree(current, components[depth]), childTree(previous, components[depth]),
        ];
        const available = combineEvidence(entries.map((entry) => entry.evidence));
        if (available.kind === "invalid") return { kind: "invalid", reason: available.reason };
        if (available.kind !== "verified") break; // unknown is NOT an absent or equal subtree
        current = entries[0].tree;
        previous = entries[1].tree;
      }
    }
    // Different or unavailable IDs never establish a positive documentation change.
    return undefined;
  }

  function documentation(sha: string): Evidence {
    const present = object(sha);
    if (present.kind !== "verified") return present;
    const { tree, parents } = header(sha);
    const parentChecks = parents.map((parent) => ({ parent, evidence: object(parent) }));
    const parentEvidence = combineEvidence(parentChecks.map((check) => check.evidence));
    if (parentEvidence.kind === "invalid") return parentEvidence; // never hide a known integrity failure
    const parentTrees = parentChecks.filter((check) => check.evidence.kind === "verified")
      .map((check) => header(check.parent).tree);
    const unchanged: Evidence = { kind: "invalid", reason: `${sha} did not change docs/engineering/` };
    // A match with ANY available parent rules out a combined documentation diff, even when
    // another parent is missing. Do not require that missing object merely to reject the assertion.
    if (parentTrees.includes(tree)) return unchanged;
    const comparisonTrees = parents.length ? parentTrees : [null];
    if (parentEvidence.kind !== "verified") {
      return documentationRejection(sha, tree, comparisonTrees) ?? parentEvidence;
    }

    // Keep the original git-show semantics (including combined merge diffs and rename handling).
    // An empty, command-local shallow-file setting exposes the real parents instead of inventing
    // a root diff at a graft. It writes nothing, fetches nothing and does not alter this checkout.
    const args = ["--shallow-file", "", "show", "--name-only", "--format=", sha];
    const result = run(args);
    if (result.status === 128) {
      // Only a specific missing-object diagnostic, CONFIRMED by cat-file, is unavailable evidence.
      // Permission/corruption/process errors, unexpected output and existing wrong-type objects
      // must still fail. Do not scan every tree preemptively: let Git identify a needed object.
      const missing = /^(?:fatal|error): (?:(?:unable to read|could not read) (?:(?:tree(?: entries)?|blob|object) )?|bad (?:tree )?object )\(?([0-9a-f]{40})\)?(?: blob)?$/i.exec(result.stderr);
      if (missing && objectType(missing[1]) === "missing") {
        // The whole-repository diff may need an unrelated src/ tree. Before skipping, try only
        // the local root/docs/engineering identities; equality can still prove this assertion false.
        return documentationRejection(sha, tree, comparisonTrees) ?? missingObject(missing[1], "object");
      }
    }
    const touched = gitOutput(args, result);
    return touched.split("\n").some((path) => path.startsWith("docs/engineering/")) ? VERIFIED : unchanged;
  }

  return { object, ancestry, documentation };
}

/** The 40-hex SHA recorded on the table row mentioning `label`. */
function recordedSha(document: string, label: string): string {
  const row = document.split("\n").find((line) => line.includes(label));
  expect(row, `PROJECT_STATE.md must have a row for "${label}"`).toBeDefined();
  const match = /[0-9a-f]{40}/.exec(row ?? "");
  expect(match, `the "${label}" row must record a full 40-character SHA`).not.toBeNull();
  return match ? match[0] : "";
}

/** Match the exact table field, never a prior prose mention such as "Canonical branch policy". */
function recordedValue(document: string, label: string): string {
  const rows = document.split("\n").filter((line) => line.trim().startsWith("|") && line.split("|")[1]?.trim() === label);
  if (rows.length !== 1) throw new Error(`PROJECT_STATE.md must have exactly one "${label}" table field`);
  const match = /^\s*`([^`]+)`/.exec(rows[0].split("|")[2] ?? "");
  if (!match) throw new Error(`PROJECT_STATE.md must record a backticked value for "${label}"`);
  return match[1];
}

const CURRENT = recordedSha(doc("PROJECT_STATE.md"), "Phase checkpoint (application)");
const PREVIOUS = recordedSha(doc("PROJECT_STATE.md"), "Previous phase checkpoint");
const DOCS_CHECKPOINT = recordedSha(doc("PROJECT_STATE.md"), "Documentation checkpoint (pushed)");
const PREVIOUS_DOCS = recordedSha(doc("PROJECT_STATE.md"), "Previous documentation checkpoint");

const ACTIVE_CHECKPOINTS = [CURRENT, PREVIOUS, DOCS_CHECKPOINT, PREVIOUS_DOCS];

// These immutable historical identities are the ONLY approved ancestry exemptions.
const HISTORICAL_BRANCH_TIPS: ReadonlyMap<string, string> = new Map([
  ["arena/01a0b059-parsian-music-dashboard-opus", "251af96f405df5935ee17ddc9ba6b490f7989c2d"],
  ["handoff/arena-frontend-pre-backend", "94d32de3220cee314606c0c4705e20e0fdcfb2af"],
]);

function isBranchName(name: string): boolean {
  return /^[\w./-]+$/.test(name) && name !== "HEAD" && !name.startsWith("-") && !name.includes("..")
    && name.split("/").every((part) => !!part && !part.startsWith(".") && !part.endsWith(".") && !part.endsWith(".lock"));
}

function historicalTips(document: string, active: readonly string[]): Set<string> {
  const sections = document.split(/^### Historical branch-tip references\r?$/m);
  if (sections.length !== 2) throw new Error("Exactly one historical branch-tip classification section is required");
  const section = sections[1].split(/^#{1,3} /m)[0];
  const rows = section.split("\n").filter((line) => line.trim().startsWith("|"));
  const cells = (row: string) => row.trim().split("|").slice(1, -1).map((cell) => cell.trim());
  if (rows.length !== 4 || cells(rows[0]).join("|") !== "Historical branch|Commit|Ancestry policy"
    || !/^\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|$/.test(rows[1])) {
    throw new Error("Historical classification must be the explicit two-row branch-tip table");
  }
  const tips = new Set<string>(), branches = new Set<string>();
  for (const row of rows.slice(2)) {
    const fields = cells(row);
    const branch = /^`([^`]+)`$/.exec(fields[0] ?? "")?.[1];
    const sha = /^`([0-9a-f]{40})`$/.exec(fields[1] ?? "")?.[1];
    if (!row.trim().endsWith("|") || fields.length !== 3 || !branch || !HISTORICAL_BRANCH_TIPS.has(branch)
      || !sha || fields[2] !== "existence-only" || branches.has(branch) || tips.has(sha)) {
      throw new Error(`Malformed or duplicate historical classification: ${row}`);
    }
    if (active.includes(sha)) throw new Error(`Active checkpoint ${sha} cannot be classified as historical-only`);
    if (HISTORICAL_BRANCH_TIPS.get(branch) !== sha) {
      throw new Error(`Unapproved historical classification (branch/SHA pair): ${branch} → ${sha}`);
    }
    branches.add(branch);
    tips.add(sha);
  }
  return tips;
}

function referenceEvidence(probes: ReturnType<typeof createGitEvidence>, sha: string, head: string, historical: Set<string>): Evidence {
  // Exemption is from ancestry ONLY: historical references still require a real commit.
  return historical.has(sha) ? probes.object(sha) : probes.ancestry(sha, head);
}

function branchEvidence(actual: string | null, canonical: string, session: string | undefined): Evidence {
  const expected = session === undefined ? canonical : session;
  if (!isBranchName(canonical) || !isBranchName(expected)) {
    return { kind: "invalid", reason: "Canonical/session branch must be a nonempty literal Git branch name" };
  }
  if (actual === null) return { kind: "invalid", reason: "Detached HEAD is not an authorized working branch" };
  return actual === expected ? VERIFIED : {
    kind: "invalid",
    reason: `Checkout ${actual} must equal ${expected} (${session === undefined ? "canonical default; PROJECT_STATE_WORKING_BRANCH not supplied" : "PROJECT_STATE_WORKING_BRANCH"})`,
  };
}

function checkoutBranch(run: GitRunner = runGit): string | null {
  const args = ["symbolic-ref", "--quiet", "--short", "HEAD"];
  const result = run(args);
  return result.status === 1 && !result.stderr ? null : gitOutput(args, result);
}

/** The row that describes the remote, so its shape can be policed. */
function remoteRow(document: string): string {
  const row = document.split("\n").find((line) => line.startsWith("| Remote state"));
  expect(row, "PROJECT_STATE.md must have a \"Remote state\" row").toBeDefined();
  return row ?? "";
}

/* ------------------------------------------------------------------ */
/* 1. The documents exist                                              */
/* ------------------------------------------------------------------ */

describe("the engineering state documents exist and are substantive", () => {
  it("ships every required document", () => {
    const missing = REQUIRED_DOCS.filter((name) => !existsSync(join(ENGINEERING, name)));
    expect(missing, "docs/engineering/ must contain all four recovery documents").toEqual([]);
  });

  it("none of them is a stub", () => {
    for (const name of REQUIRED_DOCS) {
      const text = doc(name);
      expect(text.length, `${name} must be substantive`).toBeGreaterThan(1500);
      expect(text.startsWith("# "), `${name} must open with a heading`).toBe(true);
      const sections = text.split("\n").filter((line) => /^#{2,3} /.test(line)).length;
      expect(sections, `${name} must be structured into sections`).toBeGreaterThan(3);
    }
  });

  it("PROJECT_STATE.md links to its three siblings", () => {
    const state = doc("PROJECT_STATE.md");
    for (const sibling of ["PHASES.md", "DECISIONS.md", "OPEN_ITEMS.md"]) {
      expect(state, `PROJECT_STATE.md must link to ${sibling}`).toContain(`](${sibling})`);
    }
  });
});

/* ------------------------------------------------------------------ */
/* 2. PROJECT_STATE.md is a usable recovery document                   */
/* ------------------------------------------------------------------ */

describe("PROJECT_STATE.md carries what a new session needs", () => {
  const state = doc("PROJECT_STATE.md");

  it("records every required field", () => {
    const required = [
      "Repository",
      "Canonical branch",
      "Phase checkpoint (application)",
      "Previous phase checkpoint",
      "Documentation checkpoint (pushed)",
      "Previous documentation checkpoint",
      "Remote state",
      "Two kinds of checkpoint",
      "Phase status",
      "Validation status",
      "Browser QA status",
      "Protected domains and invariants",
      "Known limitations",
      "Immediate next action",
      "Working conventions",
      "DO NOT",
      "Last state update",
    ];
    expect(required.filter((label) => !state.includes(label))).toEqual([]);
  });

  it("dates itself with a real calendar date", () => {
    expect(state).toMatch(/Last state update:\s*\*{0,2}\d{4}-\d{2}-\d{2}/);
  });

  it("states browser QA honestly instead of implying it passed", () => {
    expect(state).toMatch(/Browser QA status[\s\S]{0,200}NOT VERIFIED/);
  });

  it("records four distinct full-length checkpoints", () => {
    for (const sha of [CURRENT, PREVIOUS, DOCS_CHECKPOINT, PREVIOUS_DOCS]) {
      expect(sha).toMatch(/^[0-9a-f]{40}$/);
    }
    expect(
      new Set([CURRENT, PREVIOUS, DOCS_CHECKPOINT, PREVIOUS_DOCS]).size,
      "the phase and documentation checkpoints must all differ",
    ).toBe(4);
  });

  it("separates phase checkpoints from documentation checkpoints, in both documents", () => {
    // A docs-only commit is durable but is not a phase: conflating them is how a ledger starts
    // claiming product progress that never happened.
    expect(state).toContain("### Two kinds of checkpoint");
    expect(state).toMatch(/phase checkpoint/i);
    expect(state).toMatch(/documentation checkpoint/i);
    const phases = doc("PHASES.md");
    expect(phases, "PHASES.md must keep its own ledger of documentation checkpoints").toContain(
      "## Documentation checkpoints",
    );
    expect(phases).toContain(DOCS_CHECKPOINT);
    expect(phases, "the ledger keeps its history instead of overwriting it").toContain(PREVIOUS_DOCS);
  });

  it("tells the reader how to verify the remote instead of freezing a remote SHA", () => {
    // A recorded remote SHA goes stale the moment anyone pushes, and a stale value reads as a
    // fact. The durable form is the command that produces the current answer.
    const row = remoteRow(state);
    expect(row).toContain("git ls-remote");
    expect(/[0-9a-f]{40}/.test(row), "the \"Remote state\" row must not hardcode a SHA").toBe(false);
    expect(state).toMatch(/Deliberately not recorded as a value/i);
  });

  it("never claims to know the SHA of the commit that carries it", () => {
    expect(state).toMatch(/No self-referential SHAs/);
    expect(flat(doc("PHASES.md"))).toMatch(/cannot contain the SHA of the commit that carries/);
  });

  it("names the canonical branch independently of the session checkout", () => {
    expect(isBranchName(recordedValue(state, "Canonical branch"))).toBe(true);
  });

  it("explicitly classifies historical branch tips without exempting active checkpoints", () => {
    expect(historicalTips(state, ACTIVE_CHECKPOINTS)).toEqual(new Set(HISTORICAL_BRANCH_TIPS.values()));
  });

  it("ends with a recovery contract that forbids blind trust and destructive Git", () => {
    expect(state).toContain("## New Session Recovery");
    expect(state).toMatch(/verify every claim against Git/i);
    expect(state).toContain("git ls-remote");
    expect(state).toMatch(/NEVER reset, re-clone, delete, stash/i);
    expect(state).toContain("Immediate Next Action");
    // The contract must point at the recorded next action rather than inviting free choice.
    expect(state).toMatch(/Continue only from/i);
  });

  it("states the no-secrets rule for these documents", () => {
    expect(state).toMatch(/No secrets, credentials, tokens, API keys or personal data/);
  });
});

/* ------------------------------------------------------------------ */
/* 3. The recorded checkpoints are real Git objects                    */
/* ------------------------------------------------------------------ */

describe.skipIf(!gitAvailable)("the recorded checkpoints are real Git objects", () => {
  // These are always real local Git probes, not the fixtures used by the regression cases below.
  const probes = createGitEvidence();

  it("the current checkpoint exists locally and is a commit", (context) => {
    requireEvidence(context, probes.object(CURRENT));
  });

  it("the previous checkpoint exists locally and precedes the current one", (context) => {
    requireEvidence(context, probes.ancestry(PREVIOUS, CURRENT));
  });

  it("HEAD is the recorded checkpoint or a descendant of it", (context) => {
    requireEvidence(context, probes.ancestry(CURRENT, git("rev-parse", "HEAD")));
  });

  it("the documentation checkpoint is real and follows the phase checkpoint", (context) => {
    requireEvidence(context, probes.ancestry(CURRENT, DOCS_CHECKPOINT));
  });

  it("the documentation checkpoints are recorded in real chronological order", (context) => {
    expect(PREVIOUS_DOCS).not.toBe(DOCS_CHECKPOINT);
    requireEvidence(context, probes.ancestry(PREVIOUS_DOCS, DOCS_CHECKPOINT));
  });

  it("the recorded documentation checkpoint really carries documentation", (context) => {
    requireEvidence(context, probes.documentation(DOCS_CHECKPOINT));
  });

  it("HEAD descends from every checkpoint the documents record", (context) => {
    const head = git("rev-parse", "HEAD");
    requireEvidence(context, ...ACTIVE_CHECKPOINTS.map((sha) => probes.ancestry(sha, head)));
  });

  it("no document quotes a commit that does not already exist", (context) => {
    // Every reference must exist. Only explicitly classified historical branch tips are exempt
    // from HEAD ancestry; active checkpoints cannot receive that classification.
    const head = git("rev-parse", "HEAD");
    const historical = historicalTips(doc("PROJECT_STATE.md"), ACTIVE_CHECKPOINTS);
    const shas = new Set(REQUIRED_DOCS.flatMap((name) => [...doc(name).matchAll(/[0-9a-f]{40}/g)].map((match) => match[0])));
    requireEvidence(context, ...[...shas].map((sha) => referenceEvidence(probes, sha, head, historical)));
  }, 30_000);

  it("the checkout matches the explicit session branch or the canonical default", (context) => {
    requireEvidence(context, branchEvidence(
      checkoutBranch(), recordedValue(doc("PROJECT_STATE.md"), "Canonical branch"), process.env.PROJECT_STATE_WORKING_BRANCH,
    ));
  });

  it("every SHA quoted in the phase ledger is a real commit", (context) => {
    const shas = [...new Set([...doc("PHASES.md").matchAll(/[0-9a-f]{40}/g)].map((match) => match[0]))];
    expect(shas.length, "PHASES.md must quote durable SHAs").toBeGreaterThan(0);
    requireEvidence(context, ...shas.map((sha) => probes.object(sha)));
  });
});

/* Policy regression fixtures never replace the real-file/real-Git checks above, nor create a repo. */
describe("project-state Git evidence policy regressions", () => {
  const A = "a".repeat(40), B = "b".repeat(40), MISSING = "c".repeat(40), TREE = "d".repeat(40);
  const OTHER_TREE = "e".repeat(40), INTERMEDIATE = "f".repeat(40);
  const DOCS_TREE = "1".repeat(40), OTHER_DOCS_TREE = "2".repeat(40);
  const ENGINEERING_TREE = "3".repeat(40), OTHER_ENGINEERING_TREE = "4".repeat(40);
  const SOURCE_TREE = "5".repeat(40), THIRD_TREE = "6".repeat(40);
  const H1 = HISTORICAL_BRANCH_TIPS.get("arena/01a0b059-parsian-music-dashboard-opus")!;
  const H2 = HISTORICAL_BRANCH_TIPS.get("handoff/arena-frontend-pre-backend")!;
  function fixture(options: {
    shallow?: string[];
    partial?: boolean;
    types?: Record<string, string>;
    parents?: Record<string, string[]>;
    trees?: Record<string, string>;
    treeEntries?: Record<string, string[]>;
    mergeStatus?: number;
    touched?: string;
    showError?: string;
    batchStderr?: string;
  } = {}) {
    const calls: string[][] = [];
    const types: Record<string, string> = {
      [A]: "commit", [B]: "commit", [TREE]: "tree", [OTHER_TREE]: "tree",
      [DOCS_TREE]: "tree", [OTHER_DOCS_TREE]: "tree", [ENGINEERING_TREE]: "tree",
      [OTHER_ENGINEERING_TREE]: "tree", [SOURCE_TREE]: "tree", [THIRD_TREE]: "tree", ...options.types,
    };
    const run: GitRunner = (args, input) => {
      calls.push(args);
      // Keep the command-local override visible to assertions; normalize only fixture dispatch.
      const command = args[0] === "--shallow-file" ? args.slice(2) : args;
      let stdout = "", status = 0, stderr = "";
      if (command[0] === "cat-file" && command[1].startsWith("--batch-check")) {
        const sha = input!.trim();
        stdout = `${sha} ${types[sha] ?? "missing"}`;
        stderr = options.batchStderr ?? "";
      } else if (command[0] === "cat-file" && command[1] === "-p") {
        stdout = `tree ${options.trees?.[command[2]] ?? TREE}\n${(options.parents?.[command[2]] ?? []).map((parent) => `parent ${parent}\n`).join("")}\nfixture`;
      } else if (command[0] === "rev-parse" && command[1] === "--is-shallow-repository") {
        stdout = options.shallow?.length ? "true" : "false";
      } else if (command[0] === "config") {
        if (command[1] === "--type=bool" && options.partial) stdout = "remote.origin.promisor true";
        else status = 1;
      } else if (command[0] === "merge-base") {
        status = options.mergeStatus ?? 1;
      } else if (command[0] === "show") {
        stdout = options.touched ?? "";
        if (options.showError) { status = 128; stderr = options.showError; }
      } else if (command[0] === "ls-tree") {
        const separator = command.indexOf("--");
        if (separator >= 0) {
          const entries = options.treeEntries?.[command[separator - 1]] ?? [];
          stdout = entries.filter((entry) => entry.split("\t")[1] === command[separator + 1])
            .map((entry) => entry + "\0").join("");
        } else {
          stdout = (options.treeEntries?.[command[command.length - 1]] ?? []).join("\n");
        }
      } else {
        throw new Error(`Unexpected fixture command: ${args.join(" ")}`);
      }
      return { status, stdout, stderr: stderr || (status > 1 ? "fatal: unexpected fixture error" : "") };
    };
    return { probes: createGitEvidence(run), run, calls };
  }

  const objectDatabaseError = "error: object directory /unavailable-objects does not exist; check .git/objects/info/alternates";

  it("fails a status-zero batch missing response with an object-database error, never SKIP", () => {
    const { probes, run } = fixture({ shallow: [B], batchStderr: objectDatabaseError });
    expect(run(["cat-file", "--batch-check=%(objectname) %(objecttype)"], `${MISSING}\n`)).toEqual({
      status: 0, stdout: `${MISSING} missing`, stderr: objectDatabaseError,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(MISSING))).toThrow(/object directory.*does not exist/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("keeps a clean status-zero batch missing response UNVERIFIABLE in a shallow checkout", () => {
    const { probes, run } = fixture({ shallow: [B] });
    expect(run(["cat-file", "--batch-check=%(objectname) %(objecttype)"], `${MISSING}\n`)).toEqual({
      status: 0, stdout: `${MISSING} missing`, stderr: "",
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(MISSING))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:.*missing commit object/));
  });

  it.each([
    "fatal: unable to read object database configuration",
    "BUG: invalid object database state",
    `hint: checking the alternate object database\n${objectDatabaseError}`,
  ])("rejects batch error diagnostics even with status zero: %s", (diagnostic) => {
    const { probes } = fixture({ partial: true, batchStderr: diagnostic });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(MISSING))).toThrow(/Git batch lookup reported an error/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("preserves non-error batch warnings and hints for existing and missing objects", () => {
    const { probes } = fixture({
      shallow: [B],
      batchStderr: "warning: graft support is deprecated\nhint: the text error: here is explanatory, not an error diagnostic",
    });
    const existing = { skip: vi.fn() };
    expect(() => requireEvidence(existing, probes.object(A))).not.toThrow();
    expect(existing.skip).not.toHaveBeenCalled();
    const missing = { skip: vi.fn() };
    expect(() => requireEvidence(missing, probes.object(MISSING))).not.toThrow();
    expect(missing.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
  });

  it("does not accept an existing-object response accompanied by a batch error", () => {
    const { probes } = fixture({ partial: true, batchStderr: objectDatabaseError });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(A))).toThrow(/object directory.*does not exist/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("does not cache a batch response that carried an object-database error", () => {
    const { run } = fixture({ shallow: [B] });
    let attempts = 0;
    const probes = createGitEvidence((args, input) => {
      const result = run(args, input);
      if (args[0] === "cat-file" && args[1].startsWith("--batch-check") && ++attempts === 1) {
        return { ...result, stderr: objectDatabaseError };
      }
      return result;
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(MISSING))).toThrow(/object directory.*does not exist/);
    expect(context.skip).not.toHaveBeenCalled();
    expect(() => requireEvidence(context, probes.object(MISSING))).not.toThrow();
    expect(attempts).toBe(2);
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
  });

  it("dispatches missing-object evidence in a shallow checkout to SKIP, never PASS", () => {
    const { probes } = fixture({ shallow: [B] });
    const evidence = probes.object(MISSING);
    expect(evidence.kind).toBe("unverifiable");
    const context = { skip: vi.fn() };
    requireEvidence(context, evidence);
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:.*missing commit object/));
  });

  it("fails on a missing referenced object in a complete checkout", () => {
    const evidence = fixture().probes.object(MISSING);
    expect(evidence.kind).toBe("invalid");
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, evidence)).toThrow(/missing commit object in complete checkout/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("recognizes missing promised objects without attempting a fetch", () => {
    const { probes, calls } = fixture({ partial: true });
    expect(probes.object(MISSING).kind).toBe("unverifiable");
    expect(calls.some((args) => args[0] === "fetch")).toBe(false);
  });

  it.each(["tree", "blob", "tag"])("fails a %s object even in a shallow checkout", (type) => {
    expect(fixture({ shallow: [B], types: { [A]: type } }).probes.object(A)).toEqual({
      kind: "invalid", reason: `${A} is a ${type}, not a commit`,
    });
  });

  it("does not hide a known failure behind an earlier unavailable object", () => {
    const { probes } = fixture({ shallow: [B], types: { [A]: "blob" } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.object(MISSING), probes.object(A))).toThrow(/not a commit/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("fails proven non-ancestry with complete relevant history", () => {
    expect(fixture().probes.ancestry(A, B)).toEqual({
      kind: "invalid", reason: `${A} is not an ancestor of ${B} (complete relevant history)`,
    });
  });

  it("rejects an unavailable older endpoint when the available newer commit is a true root", () => {
    const { probes, calls } = fixture({ partial: true, types: { [A]: "missing" }, parents: { [B]: [] } });
    const context = { skip: vi.fn() };
    expect(A).not.toBe(B);
    expect(() => requireEvidence(context, probes.ancestry(A, B))).toThrow(/not an ancestor.*complete relevant history/);
    expect(context.skip).not.toHaveBeenCalled();
    expect(calls).toContainEqual(["cat-file", "-p", B]);
    expect(calls.some((args) => args[0] === "merge-base")).toBe(false);
  });

  it("keeps unavailable older and incomplete newer ancestry UNVERIFIABLE", () => {
    const { probes } = fixture({ partial: true, types: { [A]: "missing" }, parents: { [B]: [MISSING] } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.ancestry(A, B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
  });

  it("rejects an unavailable older endpoint after a complete multi-commit newer traversal", () => {
    const { probes, calls } = fixture({
      partial: true, types: { [A]: "missing", [INTERMEDIATE]: "commit" },
      parents: { [B]: [INTERMEDIATE], [INTERMEDIATE]: [] },
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.ancestry(A, B))).toThrow(/not an ancestor.*complete relevant history/);
    expect(context.skip).not.toHaveBeenCalled();
    expect(calls).toContainEqual(["cat-file", "-p", INTERMEDIATE]);
  });

  it("does not PASS merely because an available parent link names the unavailable older endpoint", () => {
    const { probes } = fixture({ partial: true, types: { [A]: "missing" }, parents: { [B]: [A] } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.ancestry(A, B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:.*missing commit object/));
  });

  it("keeps an unavailable newer endpoint UNVERIFIABLE rather than walking nonexistent history", () => {
    const { probes, calls } = fixture({ partial: true, types: { [B]: "missing" } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.ancestry(A, B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
    expect(calls.some((args) => args[0] === "cat-file" && args[1] === "-p")).toBe(false);
  });

  it("does not hide a newer-history Git error behind an unavailable older endpoint", () => {
    const { run } = fixture({ partial: true, types: { [A]: "missing" } });
    const probes = createGitEvidence((args, input) => args[0] === "cat-file" && args[1] === "-p" && args[2] === B
      ? { status: 128, stdout: "", stderr: "fatal: permission denied" } : run(args, input));
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.ancestry(A, B))).toThrow(/permission denied/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("marks a negative ancestry answer across a shallow boundary unverifiable", () => {
    const { probes } = fixture({ shallow: [B], parents: { [B]: [MISSING] } });
    expect(probes.ancestry(A, B)).toEqual({
      kind: "unverifiable", reason: `${MISSING}: missing commit object in shallow/partial checkout`,
    });
  });

  it("does not excuse non-ancestry because an unrelated branch is shallow", () => {
    const { probes } = fixture({ shallow: [A], parents: { [A]: [MISSING] } });
    expect(probes.ancestry(A, B).kind).toBe("invalid");
  });

  it("accepts proven ancestry inside available history without blanket-skipping shallow clones", () => {
    const { probes } = fixture({ shallow: [A], parents: { [A]: [MISSING], [B]: [A] }, mergeStatus: 0 });
    expect(probes.ancestry(A, B)).toEqual(VERIFIED);
  });

  it("verifies a direct parent in a partial clone without requiring history before that parent", () => {
    const { probes, calls } = fixture({ partial: true, parents: { [B]: [A], [A]: [MISSING] } });
    expect(probes.ancestry(A, B)).toEqual(VERIFIED);
    expect(calls.some((args) => args[0] === "cat-file" && args[1] === "-p" && args[2] === A)).toBe(false);
  });

  it("verifies a transitive local path despite an unavailable side path and older history", () => {
    const { probes, calls } = fixture({
      partial: true, types: { [INTERMEDIATE]: "commit" },
      parents: { [B]: [MISSING, INTERMEDIATE], [INTERMEDIATE]: [A], [A]: [MISSING] },
    });
    expect(probes.ancestry(A, B)).toEqual(VERIFIED);
    expect(calls.some((args) => args[0] === "cat-file" && args[1] === "-p" && args[2] === A)).toBe(false);
  });

  it("does not hide an observed wrong-type parent behind a later positive path", () => {
    const { probes } = fixture({ partial: true, types: { [MISSING]: "blob" }, parents: { [B]: [MISSING, A] } });
    expect(probes.ancestry(A, B).kind).toBe("invalid");
  });

  it("can prove a parent link hidden by a shallow graft when both objects are local", () => {
    const { probes } = fixture({ shallow: [B], parents: { [B]: [A], [A]: [MISSING] }, mergeStatus: 1 });
    expect(probes.ancestry(A, B)).toEqual(VERIFIED);
  });

  it("still rejects non-ancestry when the relevant graph in a partial clone is complete", () => {
    expect(fixture({ partial: true }).probes.ancestry(A, B).kind).toBe("invalid");
  });

  it("detects a missing intermediate promisor parent before Git traversal", () => {
    const { probes, calls } = fixture({ partial: true, parents: { [B]: [MISSING] } });
    expect(probes.ancestry(A, B).kind).toBe("unverifiable");
    expect(calls.some((args) => args[0] === "merge-base")).toBe(false);
  });

  it("does not swallow unexpected ancestry errors, even in a shallow clone", () => {
    const { probes } = fixture({ shallow: [B], mergeStatus: 128 });
    expect(() => probes.ancestry(A, B)).toThrow(/Unexpected Git error \(128\).*merge-base/);
  });

  it("does not classify an object-probe process error as a missing object", () => {
    const probes = createGitEvidence(() => ({ status: 128, stdout: "", stderr: "permission denied" }));
    expect(() => probes.object(A)).toThrow(/permission denied/);
  });

  it("does not accept a malformed object-probe response", () => {
    const probes = createGitEvidence(() => ({ status: 0, stdout: "garbled", stderr: "" }));
    expect(() => probes.object(A)).toThrow(/Unexpected cat-file response/);
  });

  it("forces offline, non-mutating Git subprocess settings", () => {
    expect(OFFLINE_GIT_ENV.GIT_NO_LAZY_FETCH).toBe("1");
    expect(OFFLINE_GIT_ENV.GIT_ALLOW_PROTOCOL).toBe("");
    expect(OFFLINE_GIT_ENV.GIT_OPTIONAL_LOCKS).toBe("0");
  });

  it("does not claim documentation changed when a shallow commit's real parent is missing", () => {
    const { probes, calls } = fixture({ shallow: [B], parents: { [B]: [MISSING] } });
    expect(probes.documentation(B).kind).toBe("unverifiable");
    expect(calls.some((args) => args.includes("show"))).toBe(false);
  });

  it("rejects a merge matching its first parent even when its second parent is unavailable", () => {
    const { probes, calls } = fixture({ partial: true, parents: { [B]: [A, MISSING] } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/did not change docs\/engineering\//);
    expect(context.skip).not.toHaveBeenCalled();
    expect(calls.some((args) => args.includes("show") || args[0] === "ls-tree")).toBe(false);
  });

  it("rejects unchanged documentation when only an unrelated source subtree is unavailable", () => {
    const { probes, calls } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      treeEntries: {
        [TREE]: [`tree ${DOCS_TREE}\tdocs`, `tree ${MISSING}\tsrc`],
        [OTHER_TREE]: [`tree ${DOCS_TREE}\tdocs`, `tree ${SOURCE_TREE}\tsrc`],
      },
      showError: `fatal: unable to read tree (${MISSING})`,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/did not change docs\/engineering\//);
    expect(context.skip).not.toHaveBeenCalled();
    const reads = calls.filter((args) => args[0] === "ls-tree");
    expect(reads.map((args) => args.slice(-3))).toEqual([[TREE, "--", "docs"], [OTHER_TREE, "--", "docs"]]);
  });

  it("rejects an unchanged engineering subtree even when the docs roots differ", () => {
    const { probes, calls } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      treeEntries: {
        [TREE]: [`tree ${DOCS_TREE}\tdocs`],
        [OTHER_TREE]: [`tree ${OTHER_DOCS_TREE}\tdocs`],
        [DOCS_TREE]: [`tree ${ENGINEERING_TREE}\tengineering`, `tree ${MISSING}\tother`],
        [OTHER_DOCS_TREE]: [`tree ${ENGINEERING_TREE}\tengineering`, `tree ${SOURCE_TREE}\tother`],
      },
      showError: `fatal: unable to read tree (${MISSING})`,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/did not change docs\/engineering\//);
    expect(context.skip).not.toHaveBeenCalled();
    expect(calls.filter((args) => args[0] === "ls-tree").map((args) => args.slice(-3))).toEqual([
      [TREE, "--", "docs"], [OTHER_TREE, "--", "docs"],
      [DOCS_TREE, "--", "engineering"], [OTHER_DOCS_TREE, "--", "engineering"],
    ]);
  });

  it("keeps a missing second parent unverifiable when available target identities differ", () => {
    const { probes } = fixture({
      partial: true, parents: { [B]: [A, MISSING] }, trees: { [A]: OTHER_TREE },
      treeEntries: {
        [TREE]: [`tree ${DOCS_TREE}\tdocs`],
        [OTHER_TREE]: [`tree ${OTHER_DOCS_TREE}\tdocs`],
        [DOCS_TREE]: [`tree ${ENGINEERING_TREE}\tengineering`],
        [OTHER_DOCS_TREE]: [`tree ${OTHER_ENGINEERING_TREE}\tengineering`],
      },
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:.*missing commit object/));
  });

  it("does not confuse two unavailable root trees with two absent documentation directories", () => {
    const { probes } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      types: { [TREE]: "missing", [OTHER_TREE]: "missing" },
      showError: `fatal: unable to read tree (${TREE})`,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
  });

  it("keeps genuinely unavailable changed engineering evidence as SKIP, never PASS", () => {
    const { probes } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      treeEntries: {
        [TREE]: [`tree ${DOCS_TREE}\tdocs`],
        [OTHER_TREE]: [`tree ${OTHER_DOCS_TREE}\tdocs`],
        [DOCS_TREE]: [`tree ${MISSING}\tengineering`],
        [OTHER_DOCS_TREE]: [`tree ${ENGINEERING_TREE}\tengineering`],
      },
      showError: `fatal: unable to read tree (${MISSING})`,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).not.toThrow();
    expect(context.skip).toHaveBeenCalledWith(expect.stringMatching(/^UNVERIFIABLE:/));
  });

  it("can reject a true root with known absent documentation despite an unavailable source tree", () => {
    const { probes } = fixture({
      partial: true, treeEntries: { [TREE]: [`tree ${MISSING}\tsrc`] },
      showError: `fatal: unable to read tree (${MISSING})`,
    });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/did not change docs\/engineering\//);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("does not turn a path-inspection Git error into a SKIP for the unrelated missing object", () => {
    const { run } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      showError: `fatal: unable to read tree (${MISSING})`,
    });
    const probes = createGitEvidence((args, input) => args[0] === "ls-tree"
      ? { status: 128, stdout: "", stderr: "fatal: permission denied" } : run(args, input));
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/permission denied/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("retains wrong-type parent failure ahead of an available identical-tree rejection", () => {
    const { probes } = fixture({ partial: true, parents: { [B]: [A, MISSING] }, types: { [MISSING]: "blob" } });
    const context = { skip: vi.fn() };
    expect(() => requireEvidence(context, probes.documentation(B))).toThrow(/is a blob, not a commit/);
    expect(context.skip).not.toHaveBeenCalled();
  });

  it("identical trees prove no change without reading unavailable descendants", () => {
    const { probes, calls } = fixture({
      partial: true, parents: { [B]: [A] }, treeEntries: { [TREE]: [`tree ${MISSING}`] },
    });
    expect(probes.documentation(B)).toEqual({ kind: "invalid", reason: `${B} did not change docs/engineering/` });
    expect(calls.some((args) => args[0] === "ls-tree" || args.includes("show"))).toBe(false);
  });

  it("identical tree IDs remain decisive even when the trees themselves are unavailable", () => {
    const { probes } = fixture({ partial: true, parents: { [B]: [A] }, types: { [TREE]: "missing" } });
    expect(probes.documentation(B).kind).toBe("invalid");
  });

  it("uses the original git-show diff against real parents, not a shallow root diff", () => {
    const { probes, calls } = fixture({ shallow: [B], parents: { [B]: [A] }, trees: { [A]: OTHER_TREE } });
    expect(probes.documentation(B).kind).toBe("invalid");
    expect(calls.find((args) => args.includes("show"))).toEqual([
      "--shallow-file", "", "show", "--name-only", "--format=", B,
    ]);
    expect(calls.some((args) => args[0] === "diff-tree" || args[0] === "ls-tree")).toBe(false);
  });

  it("accepts a verified documentation change using the original git-show command", () => {
    const { probes, calls } = fixture({
      parents: { [B]: [A] }, trees: { [A]: OTHER_TREE }, touched: "docs/engineering/PROJECT_STATE.md",
    });
    expect(probes.documentation(B)).toEqual(VERIFIED);
    expect(calls.find((args) => args.includes("show"))).toEqual([
      "--shallow-file", "", "show", "--name-only", "--format=", B,
    ]);
  });

  it("does not turn a rename out of docs into a docs deletion by changing diff flags or pathspecs", () => {
    const { probes } = fixture({ parents: { [B]: [A] }, trees: { [A]: OTHER_TREE }, touched: "src/moved.md" });
    expect(probes.documentation(B).kind).toBe("invalid");
  });

  it("a merge differing in documentation only from its second parent retains git-show rejection", () => {
    const { run, calls } = fixture({
      parents: { [B]: [A, INTERMEDIATE] }, types: { [INTERMEDIATE]: "commit" },
      trees: { [A]: OTHER_TREE, [INTERMEDIATE]: THIRD_TREE },
      treeEntries: {
        [TREE]: [`tree ${DOCS_TREE}\tdocs`],
        [OTHER_TREE]: [`tree ${DOCS_TREE}\tdocs`],
        [THIRD_TREE]: [`tree ${OTHER_DOCS_TREE}\tdocs`],
      },
      // Roots differ outside docs, but the merge's docs match A. Only the second parent differs
      // in documentation; the original combined git-show diff reports no documentation paths.
      touched: "",
    });
    const separateDiffs: string[][] = [];
    const probes = createGitEvidence((args, input) => {
      if (args[0] === "diff-tree") {
        separateDiffs.push(args);
        return { status: 0, stdout: args.includes(INTERMEDIATE) ? "docs/engineering/PROJECT_STATE.md" : "", stderr: "" };
      }
      return run(args, input);
    });
    expect(probes.documentation(B).kind).toBe("invalid");
    expect(calls.find((args) => args.includes("show"))).toEqual([
      "--shallow-file", "", "show", "--name-only", "--format=", B,
    ]);
    expect(separateDiffs).toEqual([]);
  });

  it("does not preflight unrelated trees before Git can answer the documentation assertion", () => {
    const { probes, calls } = fixture({
      partial: true, parents: { [B]: [A] }, trees: { [A]: OTHER_TREE },
      treeEntries: { [TREE]: [`tree ${MISSING}`], [OTHER_TREE]: [`tree ${MISSING}`] },
      touched: "docs/engineering/PROJECT_STATE.md",
    });
    expect(probes.documentation(B)).toEqual(VERIFIED);
    expect(calls.some((args) => args[0] === "ls-tree")).toBe(false);
  });

  it.each([true, false])("classifies an object actually needed by git show (partial=%s)", (partial) => {
    const { probes, calls } = fixture({
      partial, types: { [TREE]: "missing" }, showError: `fatal: unable to read tree (${TREE})`,
    });
    expect(probes.documentation(B).kind).toBe(partial ? "unverifiable" : "invalid");
    expect(calls.some((args) => args.includes("show"))).toBe(true);
    expect(calls.some((args) => args[0] === "ls-tree")).toBe(false);
  });

  it("does not disguise a git-show permission error as missing evidence", () => {
    const { probes } = fixture({ partial: true, types: { [TREE]: "missing" }, showError: "fatal: permission denied" });
    expect(() => probes.documentation(B)).toThrow(/permission denied/);
  });

  it("does not skip a read error when the reported object actually exists", () => {
    const { probes } = fixture({ partial: true, showError: `fatal: unable to read tree (${TREE})` });
    expect(() => probes.documentation(B)).toThrow(/Unexpected Git error/);
  });

  it("exempts an approved historical tip only from ancestry, not commit existence", () => {
    const { probes, calls } = fixture({ types: { [H1]: "commit" } });
    const historical = new Set([H1, H2]);
    expect(referenceEvidence(probes, H1, B, historical)).toEqual(VERIFIED);
    expect(calls.some((args) => args[0] === "merge-base")).toBe(false);
    expect(referenceEvidence(probes, H2, B, historical).kind).toBe("invalid");
  });

  it("still skips unavailable historical evidence and fails historical wrong-type objects", () => {
    const { probes } = fixture({ shallow: [B], types: { [H1]: "blob" } });
    const historical = new Set([H1, H2]);
    expect(referenceEvidence(probes, H2, B, historical).kind).toBe("unverifiable");
    expect(referenceEvidence(probes, H1, B, historical).kind).toBe("invalid");
  });

  it("retains ancestry validation for every non-exempt reference", () => {
    expect(referenceEvidence(fixture().probes, A, B, new Set([H1, H2])).kind).toBe("invalid");
  });

  const table = [
    "### Historical branch-tip references", "",
    "| Historical branch | Commit | Ancestry policy |", "|---|---|---|",
    `| \`arena/01a0b059-parsian-music-dashboard-opus\` | \`${H1}\` | existence-only |`,
    `| \`handoff/arena-frontend-pre-backend\` | \`${H2}\` | existence-only |`,
  ].join("\n");

  it("parses only the bounded table containing the exact approved historical pairs", () => {
    expect(historicalTips(table + "\n### Other section\n| not a classification |", [])).toEqual(new Set([H1, H2]));
  });

  it("rejects any active checkpoint classified as historical", () => {
    expect(() => historicalTips(table, [H1])).toThrow(/Active checkpoint.*cannot be classified/);
  });

  it("rejects a valid-looking replacement SHA even if it identifies a real commit", () => {
    expect(fixture().probes.object(A)).toEqual(VERIFIED);
    expect(() => historicalTips(table.replace(H1, A), [])).toThrow(/Unapproved historical classification.*branch\/SHA pair/);
  });

  it("rejects swapped approved SHAs: membership is the exact branch/SHA pair, not set size", () => {
    const swapped = table.replace(H1, "PLACEHOLDER").replace(H2, H1).replace("PLACEHOLDER", H2);
    expect(() => historicalTips(swapped, [])).toThrow(/Unapproved historical classification.*branch\/SHA pair/);
  });

  it.each([
    ["short SHA", table.replace(H1, "abc123")],
    ["duplicate SHA", table.replace(H2, H1)],
    ["duplicate branch", table.replace("handoff/arena-frontend-pre-backend", "arena/01a0b059-parsian-music-dashboard-opus")],
    ["wrong policy", table.replace("existence-only", "skip-all-checks")],
    ["unapproved branch", table.replace("arena/01a0b059-parsian-music-dashboard-opus", "main")],
    ["extra row", table + `\n| \`other\` | \`${MISSING}\` | existence-only |`],
    ["duplicate section", table + "\n" + table],
    ["prose rather than a heading", table.replace("### Historical", "Prose mentioning ### Historical")],
  ])("rejects malformed historical classification: %s", (_name, malformed) => {
    expect(() => historicalTips(malformed, [])).toThrow(/classification/i);
  });

  it("reads the exact canonical table field, not an earlier prose occurrence", () => {
    const text = "Canonical branch policy: `wrong`\n| Canonical branch | `main` — canonical |";
    expect(recordedValue(text, "Canonical branch")).toBe("main");
    expect(() => recordedValue(text + "\n| Canonical branch | `other` |", "Canonical branch")).toThrow(/exactly one/);
  });

  it("accepts the exact explicitly assigned session branch", () => {
    expect(branchEvidence("arena/assigned", "main", "arena/assigned")).toEqual(VERIFIED);
  });

  it("defaults to canonical only when the session input is absent", () => {
    expect(branchEvidence("main", "main", undefined)).toEqual(VERIFIED);
    expect(branchEvidence("arena/assigned", "main", undefined)).toEqual({
      kind: "invalid", reason: "Checkout arena/assigned must equal main (canonical default; PROJECT_STATE_WORKING_BRANCH not supplied)",
    });
  });

  it("rejects mismatched session input, including another Arena branch", () => {
    expect(branchEvidence("arena/assigned", "main", "arena/other").kind).toBe("invalid");
    expect(branchEvidence("main", "main", "arena/assigned").kind).toBe("invalid");
  });

  it.each(["", " main ", "arena/*", "HEAD", "@{-1}", "topic..other", "topic//other", "topic.lock"])(
    "rejects an invalid or nonliteral session branch: %j", (input) => {
      expect(branchEvidence(input, "main", input).kind).toBe("invalid");
    },
  );

  it("rejects detached HEAD even with an explicit session expectation", () => {
    const actual = checkoutBranch(() => ({ status: 1, stdout: "", stderr: "" }));
    expect(actual).toBeNull();
    expect(branchEvidence(actual, "main", "arena/assigned")).toEqual({
      kind: "invalid", reason: "Detached HEAD is not an authorized working branch",
    });
  });

  it("does not reinterpret a branch-probe Git error as detached HEAD", () => {
    expect(() => checkoutBranch(() => ({ status: 128, stdout: "", stderr: "permission denied" }))).toThrow(/permission denied/);
  });
});

/* ------------------------------------------------------------------ */
/* 4. No secret material                                               */
/* ------------------------------------------------------------------ */

describe("no secret material is pasted into the state documents", () => {
  // The same classes privacyPosture.test.ts enforces for source, plus the token shapes that
  // are easy to paste by accident from a terminal session or a CI log. Written as patterns so
  // this file does not itself contain the literal markers it forbids.
  const forbidden: ReadonlyArray<readonly [string, RegExp]> = [
    ["private key block", /BEGIN (?:RSA|OPENSSH|EC|DSA|PGP) PRIVATE KEY/],
    ["PEM marker", /-----BEGIN/],
    ["JWT literal", /eyJ[A-Za-z0-9_-]{20,}\.eyJ[A-Za-z0-9_-]{20,}\./],
    ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,}\b/],
    ["GitHub fine-grained PAT", /\bgithub_pat_[A-Za-z0-9_]{20,}\b/],
    ["AWS access key id", /\bAKIA[0-9A-Z]{16}\b/],
    ["Slack-style token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
    ["vendor API key", /\bsk-[A-Za-z0-9_-]{20,}\b/],
    ["bearer token", /Bearer\s+[A-Za-z0-9._~+/=-]{20,}/i],
    ["hardcoded access slug", /["'`][a-f0-9]{32}["'`]/],
    ["demo passphrase literal", /["'`]arena-demo["'`]/],
    ["connection string with credentials", /(?:postgres|postgresql|mysql|mongodb|redis|amqp):\/\/[^/\s:]+:[^/\s@]+@/i],
    ["environment assignment with a secret-looking value", /(?:SECRET|TOKEN|PASSWORD|API_KEY|PRIVATE_KEY)\s*[:=]\s*["']?[A-Za-z0-9+/_=-]{16,}/i],
  ];

  for (const name of REQUIRED_DOCS) {
    it(`${name} contains no credential material`, () => {
      const text = doc(name);
      for (const [label, pattern] of forbidden) {
        expect(pattern.test(text), `${name} must not contain a ${label}`).toBe(false);
      }
    });
  }

  it("points at the demo credential documentation instead of copying it", () => {
    // The demo passphrase is a deliberately committed non-secret (docs/architecture/auth.md),
    // but these documents are pasted into fresh session contexts, so they carry no credential
    // value at all — not even a development-only one.
    expect(doc("DECISIONS.md")).toMatch(/demo passphrase[\s\S]{0,240}docs\/architecture\/auth\.md/);
  });
});

/* ------------------------------------------------------------------ */
/* 5. References resolve                                               */
/* ------------------------------------------------------------------ */

describe("document references resolve", () => {
  it("every relative markdown link points at a file that exists", () => {
    const broken: string[] = [];
    for (const name of REQUIRED_DOCS) {
      const base = dirname(join(ENGINEERING, name));
      for (const match of doc(name).matchAll(/\]\(([^)\s]+)\)/g)) {
        const raw = match[1];
        if (/^(https?:|mailto:|#)/.test(raw)) continue;
        const target = raw.split("#")[0];
        if (!target) continue;
        if (!existsSync(resolve(base, target))) broken.push(`${name} → ${raw}`);
      }
    }
    expect(broken).toEqual([]);
  });

  it("every backticked src/ or docs/ path exists in the repository", () => {
    // Evidence in these documents is written as `src/views/Scheduling.tsx:144`. A stale path
    // sends the next session hunting for a file that moved, so each one is checked. Globs,
    // placeholders and directory prefixes are skipped; a `:line` suffix is stripped.
    const broken: string[] = [];
    for (const name of REQUIRED_DOCS) {
      for (const match of doc(name).matchAll(/`((?:src|docs)\/[^`\s]+)`/g)) {
        const raw = match[1];
        if (/[{}*<>]/.test(raw) || raw.endsWith("/")) continue;
        const path = raw.replace(/:\d+$/, "");
        if (!existsSync(join(ROOT, path))) broken.push(`${name} → ${raw}`);
      }
    }
    expect(broken, "every referenced path must exist").toEqual([]);
  });
});

/* ------------------------------------------------------------------ */
/* 6. The backlog cannot be silently emptied                           */
/* ------------------------------------------------------------------ */

describe("deferred work stays visible as deferred", () => {
  const open = doc("OPEN_ITEMS.md");

  it("keeps its category headings", () => {
    const headings = [
      "## CRITICAL / HIGH",
      "## IMPORTANT",
      "## LOWER PRIORITY / HYGIENE",
      "## DOCUMENTATION DRIFT",
      "## BACKEND",
    ];
    expect(headings.filter((heading) => !open.includes(heading))).toEqual([]);
  });

  it("keeps the landmark findings from the completed Phase 2 review", () => {
    const landmarks = [
      "Scheduling and Attendance views ignore their own real domains",
      "Fake-success UX",
      "level assignment",
      "Telegram",
      "code-splitting",
      "Backup envelope",
      "sidebar badges",
      "Dashboard insight panels",
      "student-role decision",
    ];
    expect(landmarks.filter((item) => !open.includes(item))).toEqual([]);
  });

  it("requires evidence for every item", () => {
    expect(open).toMatch(/carries evidence/i);
    // Each numbered item names at least one file, test or document path.
    const items = open.split(/\n### /).slice(1);
    expect(items.length, "OPEN_ITEMS.md must keep its itemised backlog").toBeGreaterThanOrEqual(10);
    const unevidenced = items.filter((item) => !/(?:src|docs)\//.test(item));
    expect(unevidenced.map((item) => item.split("\n")[0])).toEqual([]);
  });

  it("forbids reporting deferred work as finished", () => {
    expect(open).toMatch(/Deferred work must never be reported as finished work/);
  });

  it("the ledger and the state document agree the next phase has not started", () => {
    expect(doc("PHASES.md")).toMatch(/Product-feature phase \| — \| — \|.*NOT STARTED/);
    expect(doc("PROJECT_STATE.md")).toMatch(/Next phase[\s\S]{0,160}NOT STARTED/);
  });

  it("the ledger and the state document agree on every checkpoint", () => {
    const phases = doc("PHASES.md");
    expect(phases, "PHASES.md must record the phase checkpoint").toContain(CURRENT);
    expect(phases, "PHASES.md must record the previous phase checkpoint").toContain(PREVIOUS);
    expect(phases, "PHASES.md must record the documentation checkpoint").toContain(DOCS_CHECKPOINT);
    expect(phases, "PHASES.md must record the previous documentation checkpoint").toContain(PREVIOUS_DOCS);
  });

  it("the ledger warns about the older, stale phase numbering", () => {
    const phases = doc("PHASES.md");
    expect(phases).toContain("docs/gap-matrix.md");
    expect(phases).toMatch(/stale/i);
  });
});

/* ------------------------------------------------------------------ */
/* 7. The recovery instructions are honest and reproducible            */
/* ------------------------------------------------------------------ */

describe("the recovery documentation does not overpromise", () => {
  const state = doc("PROJECT_STATE.md");
  const open = doc("OPEN_ITEMS.md");

  it("records the M1 recovery path without changing clear semantics", () => {
    expect(state).toMatch(/`clear\(\)` still produces an environment nobody can sign into/);
    expect(state).toMatch(/lifecycle gate owns the controller/);
    expect(state).toContain("src/components/lifecycle/LifecycleRecoveryPanel.tsx");
    expect(state).toMatch(/outside the[\s\S]{0,80}signed-in shell/i);
    expect(state).toMatch(/exact `UninitializeResult\.message`/);
    expect(state).toMatch(/API mode has no local[\s\S]{0,60}affordance/i);
    expect(state).not.toMatch(/NO in-product recovery/);
    expect(state).not.toMatch(/no component calls it/i);
  });

  it("records H5 as landed by M1 without weakening its invariant", () => {
    expect(open).toMatch(/### H5\. Recovery from an unusable environment/);
    expect(open).toMatch(/H5[\s\S]{0,2600}LANDED/);
    expect(open).toMatch(/M1 landed the gate-owned recovery/i);
    expect(open).toContain("src/components/lifecycle/LifecycleRecoveryPanel.tsx");
    expect(open).toMatch(/calls `uninitialize`/);
    // The invariant that constrains any fix stays visible and cross-referenced.
    expect(open).toMatch(/### I10\.[^\n]*H5/);
  });

  it("installs dependencies with npm ci, never npm install", () => {
    expect(state).toContain("npm ci");
    expect(state).toMatch(/[Nn]ever `npm install`/);
    // `npm install` may appear only inside a prohibition, never as an instruction to run it.
    const imperatives = state
      .split("\n")
      .filter((line) => line.includes("npm install"))
      .filter((line) => !/never/i.test(line));
    expect(imperatives, "npm install must only ever appear in a prohibition").toEqual([]);
  });

  it("explains why the suite total can legitimately differ by eight", () => {
    expect(state).toMatch(/build artifact/i);
    expect(state).toMatch(/dist\//);
    expect(state).toMatch(/skip/i);
  });
});

/* ------------------------------------------------------------------ */
/* 8. The boot chain is a recorded decision, not tribal knowledge      */
/* ------------------------------------------------------------------ */

describe("DECISIONS.md records the boot chain and the access path", () => {
  const decisions = doc("DECISIONS.md");
  const chain = ["AccessGate", "ConfigGate", "DataLifecycleGate", "AuthProvider"];

  it("lists every gate in boot order", () => {
    const section = decisions.slice(decisions.indexOf("## 18."));
    expect(section.length, "DECISIONS.md must carry a §18").toBeGreaterThan(0);
    const positions = chain.map((gate) => section.indexOf(gate));
    expect(positions.filter((position) => position === -1), "every gate must be named in §18").toEqual([]);
    expect([...positions].sort((a, b) => a - b), "the gates must appear in boot order").toEqual(positions);
  });

  it("forbids mounting anything above a gate it depends on", () => {
    expect(decisions).toMatch(
      /No view, panel or provider may be mounted above a gate whose decision it depends on/,
    );
    expect(decisions).toContain("src/security/accessPath.ts");
    expect(decisions).toMatch(/must never be/);
    expect(decisions).toContain("scripts/gen-access-path.mjs");
  });

  it("records the M1 recovery placement and keeps API mode excluded", () => {
    expect(decisions).toMatch(/outside the signed-in shell/i);
    expect(decisions).toMatch(/API mode[\s\S]{0,80}no local recovery affordance/i);
    expect(decisions).toContain("](OPEN_ITEMS.md)");
  });
});

/* ------------------------------------------------------------------ */
/* 9. The documents are reachable from the repository entry point      */
/* ------------------------------------------------------------------ */

describe("the engineering state is discoverable from README.md", () => {
  const readme = readFileSync(join(ROOT, "README.md"), "utf8");

  it("points a new reader at PROJECT_STATE.md", () => {
    expect(readme).toContain("](docs/engineering/PROJECT_STATE.md)");
    expect(existsSync(join(ROOT, "docs", "engineering", "PROJECT_STATE.md"))).toBe(true);
  });

  it("points at the rest of the set as well", () => {
    for (const name of ["PHASES.md", "DECISIONS.md", "OPEN_ITEMS.md"]) {
      expect(readme, `README.md must link to ${name}`).toContain(`](docs/engineering/${name})`);
    }
  });

  it("names the gate that keeps the documents honest", () => {
    expect(readme).toContain("src/__tests__/projectState.test.ts");
  });
});

/* ------------------------------------------------------------------ */
/* 10. A retired race is recorded as retired — not as never happening  */
/* ------------------------------------------------------------------ */

describe("the retired test-harness race is recorded honestly", () => {
  // Phrase gates run against whitespace-collapsed text: these are prose paragraphs, and a
  // re-wrap must not be able to turn an honesty gate red.
  const state = flat(doc("PROJECT_STATE.md"));
  const open = flat(doc("OPEN_ITEMS.md"));

  it("names the file, the root cause and the boundary that owned it", () => {
    expect(open).toMatch(/### I11\. Test-harness races/);
    expect(open).toContain("src/views/__tests__/emptyEnvironment.test.tsx");
    expect(open).toContain("src/domains/shared/useResource.ts");
    expect(open, "the race must be attributed to the phase that introduced it").toMatch(
      /inherited from Phase 2/,
    );
    expect(open).toMatch(/Fixed at the boundary that owned it/);
  });

  it("records which shortcuts were NOT taken", () => {
    // A race can always be "fixed" by weakening the assertion, sleeping, or retrying until it
    // passes. Unless the document states that none of those was used, the fix is unverifiable.
    expect(open).toMatch(/No sleep, no retry, no assertion weakened or removed/);
    expect(open).toMatch(/no product source touched/i);
  });

  it("ties every green claim to a stated number of repeated runs", () => {
    // The shape is gated, not the literal count: a future pass re-measures and writes a bigger
    // number, and a gate pinned to "12" would force it to lie or to be deleted.
    expect(state).toMatch(/\d+ consecutive targeted runs/);
    expect(state).toMatch(/\d+ consecutive full/);
    expect(state).toMatch(/evidence, not a proof of determinism/i);
    expect(open).toMatch(/Only repeated runs may be reported as green/);
  });

  it("keeps the unrelated flake that was observed but not investigated visible", () => {
    expect(open).toContain("src/domains/learning/__tests__/LearningPanel.test.tsx");
    expect(open).toMatch(/deliberately not investigated/);
    expect(state).toMatch(/One honest caveat/);
  });

  it("teaches the waiting rule, so the next harness does not repeat it", () => {
    expect(state).toMatch(/Waiting for a view in tests/);
    expect(state).toContain('role="status"');
    expect(open).toMatch(/must wait for the data-derived/);
  });
});
