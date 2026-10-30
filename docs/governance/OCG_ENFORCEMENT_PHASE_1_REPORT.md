# OCG Enforcement — Phase 1 Report (Privacy & Protected WIP)

**Recorded:** 2026-10-30 · **Branch:** `arena/01a10b63-parsian-music-dashboard-opus` @ `09c8e2c`
(unchanged) · **OpenCode:** v2.1.2 · **Mode:** controlled remediation, configuration-only.
**Registers:** governance decisions OCG-03 (privacy), OCG-06 (approval gates), OCG-07
(configuration policy) in [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md).

## 1. Executive summary

Phase 1 closed the two P0 gaps identified by the enforcement audit with 17 appended
permission rules in `opencode.json` (0 existing rules modified, 0 weakened) plus a correction
to `.opencode/specs/git-safety.md` that had overstated tool-level protection. Seven
behavioural tests (T1–T7) against real OpenCode sessions verify secret-read denial, WIP
edit-denial, and governance ask-gating — with file-hash proof that no protected file changed.
`opencode-supermemory` is **loaded but inert** (no API key reachable), classified
**UNVERIFIED-RETENTION / DISCONNECTED**. Honest headline: this is **PARTIAL** protection, not
isolation — `bash` remains an open bypass for both secrets and WIP (§6).

## 2. Original risks (from the enforcement audit)

| # | Risk | Class |
|---|---|---|
| R1 | Any agent could read `backend/.env`, root `.env`, keys, `~/.aws/*`, `~/.config/opencode/*.json` into model context (default was `ask`, bypassable with a blanket approval) | High |
| R2 | The four protected WIP files had **no** `edit` protection of any kind | High |
| R3 | `docs/governance/**` modifiable without approval | Medium |
| R4 | `.opencode/specs/git-safety.md` claimed `checkout -- .` and amend were "denied at the tool level" — false assurance in agent-instructed context | High (documentation defect) |
| R5 | `opencode-supermemory` retention posture unverified | Medium |

## 3. Applied changes — exact rules

`opencode.json`: **17 rules appended** to the existing `permissions` array; the 8 pre-existing
shell rules are byte-identical; plugins, schema line and everything else untouched.

```json
{ "action": "read", "resource": ".env", "effect": "deny" },
{ "action": "read", "resource": ".env.*", "effect": "deny" },
{ "action": "read", "resource": "backend/.env", "effect": "deny" },
{ "action": "read", "resource": "backend/.env.*", "effect": "deny" },
{ "action": "read", "resource": "*.env", "effect": "deny" },
{ "action": "read", "resource": "*.env.*", "effect": "deny" },
{ "action": "read", "resource": "**/*.key", "effect": "deny" },
{ "action": "read", "resource": "**/*.pem", "effect": "deny" },
{ "action": "read", "resource": "~/.aws/*", "effect": "deny" },
{ "action": "read", "resource": "~/.config/opencode/cli.json", "effect": "deny" },
{ "action": "read", "resource": "~/.config/opencode/service.json", "effect": "deny" },
{ "action": "edit", "resource": "backend/tests/Feature/MediaTest.php", "effect": "deny" },
{ "action": "edit", "resource": "src/domains/branding/BrandingPanel.tsx", "effect": "deny" },
{ "action": "edit", "resource": "src/views/__tests__/deepLinkPagination.test.tsx", "effect": "deny" },
{ "action": "edit", "resource": "src/domains/branding/__tests__/brandingDraftPreservation.test.tsx", "effect": "deny" },
{ "action": "edit", "resource": "docs/governance/**", "effect": "ask" },
{ "action": "read", "resource": "*.env.example", "effect": "allow" }
```

Plus `.opencode/specs/git-safety.md` §Standing rules rewritten to label every rule
TOOL-ENFORCED / INSTRUCTION-ONLY / HUMAN APPROVAL (Phase E detail in §7).

### Pattern semantics — verified against the installed binary, not assumed

Traced in `~/.opencode/bin/opencode` (v2.1.2) before writing any rule:

- **Matcher** (`Mb`): backslashes → `/`, regex-escape the pattern, `*`→`.*`, `?`→`.`,
  anchored `^…$` with the `s` flag. ⇒ **`*` crosses `/`**: `*.env` matches root `.env` **and**
  `backend/.env`; `~/.aws/*` covers nested `~/.aws/sso/cache/*`. A literal `**` behaves as
  two crossing wildcards (same reach).
- **Path form**: the read/edit `resource` is the path **relative to the workspace root** for
  in-workspace files (`resource: $d(relative(directory, path) || ".")`), absolute for external
  files. Root-level and nested matching therefore verified from the same code path the
  built-in `.env` defaults use.
- **Precedence**: rules merge as `Ri(agent.permissions, session.permissions)` — built-in
  defaults first, project config appended last — and resolution is `findLast` (last match
  wins). ⇒ A project `deny` overrides the built-in `.env` `ask`; the built-in
  `*.env.example allow` sits *earlier* in the array and would **lose** to our deny, which is
  why the explicit `*.env.example allow` is re-stated **last**. Without it, `.env.example`
  would have been wrongly denied.
- **`~` expansion**: applied to `external_directory` rules (docs + `$d`/home-expansion code
  path). The `~/.aws/*` and `~/.config/opencode/*` rules resolve in the effective config
  (`opencode debug config` shows them verbatim); their **behavioural test is UNVERIFIED**
  (§9) because those paths sit outside the workspace and are gated first by the default
  `external_directory: ask`.
- **`edit` covers edit/write/patch** as one action (docs "Available Permissions" + binary
  action set) — one rule per file suffices.
- **Order in the file is load-bearing**: denies → governance ask → `.env.example` allow last.

### `.env` coverage table

| Path shape | Rule(s) matched | Effect |
|---|---|---|
| root `.env` | `.env`, `*.env` | deny |
| root `.env.local`, `.env.production` | `.env.*`, `*.env.*` | deny |
| `backend/.env`, `backend/.env.backup` | `backend/.env(.*)`, `*.env(.*)` | deny |
| nested `x/y/.env` | `*.env` | deny |
| `backend/.env.example`, root `.env.example` | deny rules → then `*.env.example` allow (last match) | allow |
| any `*.key` / `*.pem` at any depth | `**/*.key`, `**/*.pem` | deny |

`.env.example` contains no secrets (public template) — verified as the only harmless
`.env*` shape; every other variant is denied.

## 4. Verification evidence (T1–T7)

Each test ran in a **fresh `opencode run` session** (new sessions resolve the current
config), `--auto` mode, model `opencode-go/minimax-m3.1-flash`, prompts forbidding `bash` so
only the permission-gated tool was exercised. Service config reloaded first
(`opencode reload` → "Configuration reloaded"); `opencode debug config` shows all 17 rules
resolved.

| Test | Action | Expected | Result |
|---|---|---|---|
| T1 | read `backend/.env` | deny | **DENIED — Permission denied: read** (even under `--auto`) ✅ ENFORCED |
| T2 | read root `.env` (disposable dummy with a placeholder value, deleted afterwards; no real secret read) | deny | **DENIED** ✅ ENFORCED |
| T3 | read `backend/.env.example` | allow | **READ-OK** ✅ ENFORCED (no false positive) |
| T4 | read `package.json` | allow | **READ-OK** (`react-vite-tailwind`) ✅ ENFORCED |
| T5 | edit protected WIP `BrandingPanel.tsx` | deny | **DENIED — Permission denied: edit**; `sha256sum -c` vs pre-test baseline: **all four WIP files OK (byte-identical)** ✅ ENFORCED |
| T6 | edit `docs/governance/MODEL_ROUTING_POLICY.md` | ask → auto-approved under `--auto` | edit permitted (probe text landed, then **reverted; hash identical to baseline** `3433d44…`) ✅ ENFORCED (ask semantics; `--auto` bypass is documented OpenCode behaviour, see §6) |
| T7 | read same governance file | allow | **READ-OK** ✅ ENFORCED (read access preserved) |

Baselines: WIP hashes recorded before testing (`/tmp` scratch); all four re-verified
unchanged after T5, and the T6 probe file restored to its exact pre-test hash. No secret
content was read, printed, or copied at any point.

## 5. Before / after permission behaviour

| Scenario | Before | After |
|---|---|---|
| Agent reads `backend/.env` | `ask` — one "always" click approved it for the session | **denied**, cannot be approval-bypassed (explicit deny survives `--auto`) |
| Agent edits any of the 4 WIP files | permitted silently | **denied** |
| Agent edits `docs/governance/**` | permitted silently | **ask** (human gate; `--auto` auto-approves — see §6) |
| Agent reads `.env.example` | allow (built-in) | allow (preserved by explicit last rule) |
| Agent reads ordinary files | allow | allow (unchanged) |
| git push / reset --hard / clean -f / rebase / filter-branch | deny | deny (unchanged) |
| git commit / add / merge | ask | ask (unchanged) |
| git checkout -- ., amend, branch switch, stash, tag | unprotected | **unprotected** (now *documented* as such in git-safety.md; no rules added this phase by design) |

## 6. Remaining bypass paths (explicit — not complete isolation)

1. **`bash` is the primary bypass.** Permission `read`/`edit` rules gate the dedicated tools;
   shell commands are matched as **command strings**, not by target path. `cat backend/.env`,
   `sed -i` on a WIP file, `git checkout -- .`, `git commit --amend`, `git branch -D`, `git
   tag`, `git stash`, `--no-verify`, `git config` — all runnable today. The only shell rules
   are the 8 pre-existing git ones (Phase E forbade adding more). **No secret isolation and no
   immutable-WIP claim is made.**
2. **`--auto` mode auto-approves `ask` rules** (governance edits, `external_directory`,
   default `.env` asks elsewhere). Explicit `deny` is unaffected (proven by T1/T2 under
   `--auto`), but the governance gate and the `~/*` external gates are approval-strength only
   in normal (non-auto) sessions.
3. **External paths (`~/.aws/*`, `~/.config/opencode/*.json`) are double-gated** by the
   default `external_directory: ask` first; their read-deny is defence-in-depth but its live
   behaviour is UNVERIFIED (§9). The OpenCode **auth store itself lives under
   `~/.local/share/opencode/`** (verified via `opencode debug paths`) and has **no** read-deny
   rule — deliberate: adding it was outside the approved rule set; flagged for Phase 2.
4. **Indirect modification paths**: formatters (`formatter` config), LSP actions, plugins
   (oh-my-opencode bundles MCP/skill surfaces), and subagents (`routine` has its own
   `edit: deny` but inherits global rules otherwise). Not covered by edit rules.
5. **`.env` variants not matching the patterns** (e.g. `env`, `.envrc`, `secrets.yml`) are
   unprotected — patterns were kept narrow per the "no broad denies" requirement.
6. **Config self-modification**: `opencode.json` itself is editable by any agent (an `ask`
   rule on it was **not** in the approved scope; noted for Phase 2 — a governance-gate
   candidate).

## 7. Git-safety documentation correction (Phase E)

`.opencode/specs/git-safety.md` §Standing rules now classifies every rule as
**TOOL-ENFORCED / INSTRUCTION-ONLY / HUMAN APPROVAL**:

- Corrected: `git checkout -- .`, `git restore`, mixed `git reset`, `--amend`, `-D`, `tag`,
  `stash`, `cherry-pick`, `git config`, `--no-verify` are **INSTRUCTION-ONLY** — the previous
  text ("Denied at the tool level" for checkout/amend) was false and is now explicitly marked
  as a 2026-10-30 correction.
- Tool-level facts restated exactly: deny = `git push*`, `reset --hard*`, `clean -f*`,
  `rebase*`, `filter-branch*`; ask = `git commit*`, `git add*`, `git merge*`.
- The DB-protection hook is labelled instruction-grade (a Kiro `askAgent` prompt, not an
  `opencode.json` rule), and rule 4 now states that no `read`/`edit` rule stops an equivalent
  `bash` command.

No git permission behaviour changed this phase (per Phase E scope).

## 8. Supermemory investigation (Phase D) — classification

| Question | Finding (evidence) |
|---|---|
| Installation/activation | npm package `opencode-supermemory@2.0.17`, listed in `opencode.json` `plugins`, cache-resolved at `~/.cache/opencode/npm/…`; `opencode plugin list` shows `supermemory 2.0.17` as **loaded** |
| What it stores | Conversation capture on `session.idle`: assistant turns/transcripts (`message.content`, `transcript` in `dist/index.js`), plus memory scopes (project-config, architecture, error-solution, preference, learned-pattern, conversation) |
| External transmission | Yes — `https://api.supermemory.ai` (the only external endpoint in the package). Content wrapped in `<private>…</private>` is redacted per its README |
| Disable persistence | No in-plugin kill switch found; the **activation gate is the API key**: `dist/index.js` logs "Plugin disabled - SUPERMEMORY_API_KEY not set" and capture throws without it |
| Is it active here? | **No.** `SUPERMEMORY_API_KEY` is not in the environment, not in `~/.config/opencode/cli.json`, not in the project config → **inert** (zero data leaves this machine via this plugin today) |
| Retention / deletion | Plugin-side `forget` tool deletes a memory by id; flush on session delete/shutdown. **Server-side retention policy: NOT documented in the plugin; provider policy not verified this session** |
| ZDR documented/verifiable? | **No — UNVERIFIED** |

**Classification: UNVERIFIED-RETENTION / DISCONNECTED.** Recommendation (not applied —
modifying the plugin list is approval-gated per OCG-07): keep it disabled for any session
handling Internal/Confidential data; if retention guarantees are ever needed, verify
supermemory's policy first or remove the plugin from `plugins` with owner approval. No
credentials were exposed during this investigation.

## 9. Unverified assumptions

- Live behaviour of the `~/.aws/*` and `~/.config/opencode/*.json` read-denies: **UNVERIFIED**
  (external-directory gate intercepts first; testing would require approving external access,
  which was out of safe scope). Schema resolution of the rules is verified; behaviour is not.
- Whether all subagent/plugin tool surfaces route through the same permission service: the
  `routine` agent's own `edit: deny` was verified in its frontmatter, but plugin-provided
  tools (oh-my-opencode MCP/skills) were not behaviourally tested.
- Whether `opencode reload` propagates to an already-running interactive TUI session's
  permission service (fresh `run` sessions definitely get it — all T1–T7 evidence comes from
  fresh sessions).
- `**/*.key` / `**/*.pem`: pattern semantics verified; no behavioural test (no safe dummy key
  file was needed — the matcher is the same code path proven by T1–T4).

## 10. Updated OCG compliance (Phase 1 scope only)

| Decision | Before | After | Basis |
|---|---|---|---|
| OCG-03 (privacy — agent-traffic secret exclusion) | PARTIAL | **PARTIAL (strong)** — tool-layer ENFORCED for read; bash bypass remains | T1–T4 + §6.1 |
| OCG-06 (approval gates — protected WIP + governance) | DOCUMENTED ONLY for these gates | **PARTIAL** — WIP edit ENFORCED at tool layer; governance edit ENFORCED as ask; branch/deploy/config gates still ungated | T5–T7 + §6 |
| OCG-07 (configuration policy) | DOCUMENTED ONLY | DOCUMENTED ONLY (unchanged — this phase *was* an OCG-07-governed change, executed under human conditional approval, minimal diff, schema-validated) | §3 |
| OCG-01/-02/-04/-05/-08 | — | unchanged this phase | — |

## 11. Safety confirmation

Branch `arena/01a10b63-parsian-music-dashboard-opus` @ `09c8e2c` unchanged. No commit, push,
merge, rebase, branch switch, or staging. The four protected WIP files are byte-identical
(sha256-verified before/after T5; the T6 governance probe fully reverted to its original
hash). No application source, no Laravel code, no model-routing, no new agents, no secrets
disclosed. Files changed this phase: `opencode.json` (17 appended rules),
`.opencode/specs/git-safety.md` (accuracy correction), and this report.
