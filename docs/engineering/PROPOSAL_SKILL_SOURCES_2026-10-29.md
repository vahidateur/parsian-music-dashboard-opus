# PROPOSAL — high-risk skills in the source library `.agents/skills/` (2026-10-29)

> **Status: proposal only. Nothing in `.agents/skills/`, `skills-lock.json` or `opencode.json` was
> changed.** The 34 skills below were already removed from the Kiro copies
> (`SKILLS_SPECS_CLEANUP_2026-10-29.md`). This document is about the copies that **opencode** still loads.

## 1. Which source is active

| Item | Evidence |
|---|---|
| `.agents/skills/` (104 skills) is gitignored (`.gitignore`: `.agents/`) and exists only on this machine | `git check-ignore`, `skills-lock.json` is the only tracked trace |
| The three plugins in `opencode.json` are installed in `~/.cache/opencode/npm/` | `ponytail`, `opencode-supermemory`, `oh-my-opencode` 5.1.x |
| `oh-my-opencode` scans `.agents/skills`, `.opencode/skills` and `.claude/skills` | strings in `dist/cli/index.js` of the cached package |
| opencode core also loads skills from project directories (`SKILL.md` with `name` + `description`, name = folder) | opencode docs, skills page. Whether core scans `.agents/skills` itself was **not** verified (no `debug skills` subcommand in v2.1.2) |
| No user-level skill directory exists | `~/.agents`, `~/.claude`, `~/.config/opencode`, `~/.opencode`, `~/.kiro` have no `skills/` |
| The lock cannot rebuild `.agents/skills/` | the lock pins no commit; with its own hash function, 99 of 104 local folders match it, but only 92 of 104 match upstream `HEAD`, so a reinstall would change 12 skills (checked 2026-10-29) |

Consequence: **deleting from `.agents/skills/` is not repeatable from the lock.** A byte-exact snapshot of both
trees is stored outside the repo (`~/Documents/Default Project/_backups/preserve-20261029/skills-*.tar.gz`).

## 2. The 34 skills, by family

"Auto" means the description contains trigger language ("Use when…", "MUST…"), so the model may load it by itself.

| Family | Skills (source) | Activation | Effect if it runs | Depends on | Conflict |
|---|---|---|---|---|---|
| Workflow override | `using-superpowers`, `brainstorming` (obra) | Auto, forced ("before ANY response", "MUST") | Loads a skill before every answer; writes `docs/superpowers/specs/*` and commits | other superpowers skills | `AGENTS.md` "load on demand, one at a time"; commit-only-on-request |
| Git mutation | `using-git-worktrees`, `finishing-a-development-branch`, `writing-plans`, `executing-plans`, `subagent-driven-development` (obra) | Auto ("Use when…") | `git worktree add`, commits to `.gitignore`, `git merge`, `git branch -d`, discard; plan steps say "commit" | each other | git-safety rules 1 to 3 |
| Issue-tracker publishing | `setup-matt-pocock-skills`, `ask-matt`, `to-spec`, `to-tickets`, `triage`, `wayfinder`, `implement-spec`, `implement` (mattpocock) | Description-only (slash style) | `gh issue create`, labels, integration branch and PR; setup writes `AGENTS.md` sections, `docs/agents/*`, `GLOSSARY.md` | the config `setup-matt-pocock-skills` writes (absent here: no `docs/agents`, `.scratch`) | git-safety rule 1 (never publish) |
| Competing decision record | `domain-modeling` (auto), `grill-with-docs` (mattpocock) | Auto / description-only | Writes `GLOSSARY.md` and ADRs | none | `docs/engineering/DECISIONS.md` is the only decision record |
| Data egress | `caveman-setup`, `-compress`, `-discover`, `-evidence-review`, `-learn`, `-manage`, `-optimize`, `-stats` (juliusbrussee) | Auto | `setup` routes LLM traffic through `gateway.caveman.so`; `compress` sends file text to a provider and overwrites the original; others read or act on Caveman Cloud data | `GATEWAY`, `CAVE_API_KEY`, Caveman Cloud account | private panel, nothing leaves the machine |
| Not runnable here | `cavecrew` (needs `cavecrew-*` subagents), `claude-handoff` (Claude background agent), `git-guardrails-claude-code` (writes `.claude/settings.json`), `claude-api` (description 1068 characters, over the 1024 limit; unrelated) | Mixed | Fails or writes files for another tool | agents/tools this setup lacks | none, dead weight |
| Deploy and unrelated stack | `deploy-to-vercel`, `vercel-cli-with-tokens`, `vercel-optimize`, `vercel-react-native-skills` (vercel-labs), `brand-guidelines` (anthropics) | Auto | Deploys to a third party; React Native advice; Anthropic colors and fonts over the project's tokens | Vercel account and tokens | `src/index.css` tokens, deploy is `deploy/nginx.conf` |

Kept skills that mention removed ones (not edited): `code-review` (tracker config), `improve-codebase-architecture`
(calls `domain-modeling`), `caveman*` (mention `/caveman-compress`, `/caveman-stats`), `writing-skills` (example text).

## 3. Ways to switch them off (least to most invasive)

1. **opencode permission rules** in `opencode.json`. The file already uses the v2 `permissions` ruleset
   (`action`, `resource`, `effect`). opencode's docs show the same idea as `permission.skill` patterns
   (`"name": "deny"` hides the skill from the agent). The action name `"skill"` for the v2 ruleset is inferred from
   that and from the schema (`PermissionConfig.skill`); **it needs one live session to confirm**. Reversible by deleting lines.
2. **`oh-my-opencode` config**: the plugin's schema has `disabled_skills: string[]` (and `skills.disable`). The user-level
   file `~/.config/opencode/oh-my-opencode.jsonc` is confirmed in the package; a project-level
   `.opencode/oh-my-opencode.json[c]` is plausible but **not verified**. Covers only skills the plugin loads.
3. **Move the 34 folders out of `.agents/skills/`** into a parent-level `_disabled/` directory and drop their entries from
   `skills-lock.json`. Reversible by moving back. Not recommended before 1 is tried, because the lock cannot rebuild them.
4. **Delete** them. Not recommended (see section 1).

### Proposed diff for option 1 (NOT applied)

```diff
--- a/opencode.json
+++ b/opencode.json
@@ permissions @@
     { "action": "shell", "resource": "git merge*", "effect": "ask" },
+    { "action": "skill", "resource": "using-superpowers", "effect": "deny" },
+    { "action": "skill", "resource": "brainstorming", "effect": "deny" },
+    { "action": "skill", "resource": "using-git-worktrees", "effect": "deny" },
+    { "action": "skill", "resource": "finishing-a-development-branch", "effect": "deny" },
+    { "action": "skill", "resource": "writing-plans", "effect": "deny" },
+    { "action": "skill", "resource": "executing-plans", "effect": "deny" },
+    { "action": "skill", "resource": "subagent-driven-development", "effect": "deny" },
+    { "action": "skill", "resource": "setup-matt-pocock-skills", "effect": "deny" },
+    { "action": "skill", "resource": "ask-matt", "effect": "deny" },
+    { "action": "skill", "resource": "to-spec", "effect": "deny" },
+    { "action": "skill", "resource": "to-tickets", "effect": "deny" },
+    { "action": "skill", "resource": "triage", "effect": "deny" },
+    { "action": "skill", "resource": "wayfinder", "effect": "deny" },
+    { "action": "skill", "resource": "implement-spec", "effect": "deny" },
+    { "action": "skill", "resource": "implement", "effect": "deny" },
+    { "action": "skill", "resource": "domain-modeling", "effect": "deny" },
+    { "action": "skill", "resource": "grill-with-docs", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-setup", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-compress", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-discover", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-evidence-review", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-learn", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-manage", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-optimize", "effect": "deny" },
+    { "action": "skill", "resource": "caveman-stats", "effect": "deny" },
+    { "action": "skill", "resource": "cavecrew", "effect": "deny" },
+    { "action": "skill", "resource": "claude-handoff", "effect": "deny" },
+    { "action": "skill", "resource": "git-guardrails-claude-code", "effect": "deny" },
+    { "action": "skill", "resource": "claude-api", "effect": "deny" },
+    { "action": "skill", "resource": "deploy-to-vercel", "effect": "deny" },
+    { "action": "skill", "resource": "vercel-cli-with-tokens", "effect": "deny" },
+    { "action": "skill", "resource": "vercel-optimize", "effect": "deny" },
+    { "action": "skill", "resource": "vercel-react-native-skills", "effect": "deny" },
+    { "action": "skill", "resource": "brand-guidelines", "effect": "deny" }
   ]
```

(Add a comma after the existing last rule; the 34 lines are one rule each.) Acceptance test once applied: start an opencode
session and confirm the denied names are absent from the skill tool's `<available_skills>` list while `focused-fix`,
`repo-explore`, `session-start` and `target-verify` remain.

## 4. Decisions needed from the owner

1. Option 1, 2, 3 or leave as is. Suggested: option 1 for the eight `caveman-*` cloud skills, `using-superpowers`,
   `brainstorming`, `finishing-a-development-branch`, `using-git-worktrees`, `git-guardrails-claude-code` first (highest risk),
   then the rest after the live-session check.
2. Whether `docs/engineering/DECISIONS.md` stays the only decision record (then `domain-modeling` and `grill-with-docs` stay off).
3. Whether an issue tracker will ever be used (then the mattpocock family needs a deliberate `setup-matt-pocock-skills` run and a fresh review).
