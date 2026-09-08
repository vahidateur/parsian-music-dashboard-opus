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
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const ENGINEERING = join(ROOT, "docs", "engineering");
const REQUIRED_DOCS = ["PROJECT_STATE.md", "PHASES.md", "DECISIONS.md", "OPEN_ITEMS.md"];

function doc(name: string): string {
  return readFileSync(join(ENGINEERING, name), "utf8");
}

function git(...args: string[]): string {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

/** Whether this working copy can ask Git about its own objects at all. */
const gitAvailable = (() => {
  try {
    git("rev-parse", "--git-dir");
    return true;
  } catch {
    return false;
  }
})();

function isAncestor(older: string, newer: string): boolean {
  try {
    git("merge-base", "--is-ancestor", older, newer);
    return true;
  } catch {
    return false;
  }
}

function isCommit(sha: string): boolean {
  try {
    git("cat-file", "-e", `${sha}^{commit}`);
    return true;
  } catch {
    return false;
  }
}

/** The 40-hex SHA recorded on the table row mentioning `label`. */
function recordedSha(document: string, label: string): string {
  const row = document.split("\n").find((line) => line.includes(label));
  expect(row, `PROJECT_STATE.md must have a row for "${label}"`).toBeDefined();
  const match = /[0-9a-f]{40}/.exec(row ?? "");
  expect(match, `the "${label}" row must record a full 40-character SHA`).not.toBeNull();
  return match ? match[0] : "";
}

/** The backticked value on the table row mentioning `label`. */
function recordedValue(document: string, label: string): string {
  const row = document.split("\n").find((line) => line.includes(label));
  const match = /`([^`]+)`/.exec(row ?? "");
  expect(match, `PROJECT_STATE.md must record a value for "${label}"`).not.toBeNull();
  return match ? match[1] : "";
}

const CURRENT = recordedSha(doc("PROJECT_STATE.md"), "Phase checkpoint (application)");
const PREVIOUS = recordedSha(doc("PROJECT_STATE.md"), "Previous phase checkpoint");
const DOCS_CHECKPOINT = recordedSha(doc("PROJECT_STATE.md"), "Documentation checkpoint (pushed)");

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
      "Working branch",
      "Phase checkpoint (application)",
      "Previous phase checkpoint",
      "Documentation checkpoint (pushed)",
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

  it("records three distinct full-length checkpoints", () => {
    expect(CURRENT).toMatch(/^[0-9a-f]{40}$/);
    expect(PREVIOUS).toMatch(/^[0-9a-f]{40}$/);
    expect(DOCS_CHECKPOINT).toMatch(/^[0-9a-f]{40}$/);
    expect(new Set([CURRENT, PREVIOUS, DOCS_CHECKPOINT]).size, "the three checkpoints must differ").toBe(3);
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
    expect(doc("PHASES.md")).toMatch(/cannot contain the SHA of the commit\s+that carries/);
  });

  it("names the working branch, which Git can confirm", () => {
    expect(recordedValue(state, "Working branch")).toMatch(/^[\w./-]+$/);
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
  it("the current checkpoint exists locally and is a commit", () => {
    expect(isCommit(CURRENT), `${CURRENT} must be present in this clone`).toBe(true);
  });

  it("the previous checkpoint exists locally and precedes the current one", () => {
    expect(isCommit(PREVIOUS), `${PREVIOUS} must be present in this clone`).toBe(true);
    expect(isAncestor(PREVIOUS, CURRENT), `${PREVIOUS} must be an ancestor of ${CURRENT}`).toBe(true);
  });

  it("HEAD is the recorded checkpoint or a descendant of it", () => {
    // This is the check that catches a lost, reset or re-parented checkpoint: the document
    // must never point at a commit the working copy has quietly drifted away from.
    const head = git("rev-parse", "HEAD");
    expect(head === CURRENT || isAncestor(CURRENT, head), `HEAD ${head} must be ${CURRENT} or descend from it`).toBe(true);
  });

  it("the documentation checkpoint is real and follows the phase checkpoint", () => {
    expect(isCommit(DOCS_CHECKPOINT), `${DOCS_CHECKPOINT} must be present in this clone`).toBe(true);
    expect(isAncestor(CURRENT, DOCS_CHECKPOINT), `the docs checkpoint must come after ${CURRENT}`).toBe(true);
  });

  it("HEAD descends from every checkpoint the documents record", () => {
    const head = git("rev-parse", "HEAD");
    for (const sha of [CURRENT, PREVIOUS, DOCS_CHECKPOINT]) {
      expect(head === sha || isAncestor(sha, head), `HEAD ${head} must descend from ${sha}`).toBe(true);
    }
  });

  it("no document quotes a commit that does not already exist", () => {
    // The self-reference ban, made testable. A document cannot know the SHA of the commit that
    // will carry it — that SHA does not exist yet — so every full SHA a document does quote must
    // already be reachable from HEAD. A pasted future SHA, an invented one, or one left over from
    // a lost object store fails here instead of sending the next reader to a commit that is not
    // there. (Short digests that are not commits — e.g. an aggregate content hash — are not
    // 40 hex characters and are deliberately out of scope.)
    const head = git("rev-parse", "HEAD");
    for (const name of REQUIRED_DOCS) {
      for (const match of doc(name).matchAll(/[0-9a-f]{40}/g)) {
        const sha = match[0];
        expect(isCommit(sha), `${name} quotes ${sha}, which is not a commit in this clone`).toBe(true);
        expect(
          sha === head || isAncestor(sha, head),
          `${name} quotes ${sha}, which is not reachable from HEAD ${head}`,
        ).toBe(true);
      }
    }
  });

  it("the recorded working branch is the branch actually checked out", () => {
    expect(git("rev-parse", "--abbrev-ref", "HEAD")).toBe(recordedValue(doc("PROJECT_STATE.md"), "Working branch"));
  });

  it("every SHA quoted in the phase ledger is a real commit", () => {
    const shas = [...doc("PHASES.md").matchAll(/[0-9a-f]{40}/g)].map((match) => match[0]);
    expect(shas.length, "PHASES.md must quote durable SHAs").toBeGreaterThan(0);
    expect(shas.filter((sha) => !isCommit(sha))).toEqual([]);
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

  it("the ledger and the state document agree on all three checkpoints", () => {
    const phases = doc("PHASES.md");
    expect(phases, "PHASES.md must record the phase checkpoint").toContain(CURRENT);
    expect(phases, "PHASES.md must record the previous phase checkpoint").toContain(PREVIOUS);
    expect(phases, "PHASES.md must record the documentation checkpoint").toContain(DOCS_CHECKPOINT);
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

  it("says plainly that a cleared environment has no in-product recovery", () => {
    expect(state).toMatch(/NO in-product recovery/);
    expect(state).toMatch(/no component calls it/i);
    // The wording this replaces offered `uninitialize` or a backup restore as a way back.
    // Neither is reachable from inside a product that cannot be signed into.
    expect(state).not.toContain("Recovery path: `uninitialize`");
    expect(open).not.toMatch(/Recovery today:/);
  });

  it("tracks the missing recovery affordance as a critical open item", () => {
    expect(open).toMatch(/### H5\. No in-product recovery/);
    expect(open).toMatch(/H5[\s\S]{0,1600}Priority: CRITICAL/);
    expect(open).toMatch(/Deliberately not implemented/);
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

  it("cross-references the remaining gap instead of implying the chain is complete", () => {
    expect(decisions).toMatch(/no UI affordance/i);
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
