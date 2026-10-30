# Agent Workflow and Approval Gates

**Status:** ACCEPTED governance (OCG-05, OCG-06) · **Recorded:** 2026-10-30
**Applies to:** all AI-agent work in this repository.

## Workflow

**Governance → Plan → Build → Verify → Review → Human Approval**

Role definitions and permissions: [AI Agent Roles and Permissions](AI_AGENT_ROLES_AND_PERMISSIONS.md).

## Mandatory human approval

Human approval is required **before** any agent performs:

1. Git commit
2. Merge
3. Push
4. Branch switching
5. Deployment
6. Database migrations
7. Backend scope expansion
8. Changes to protected WIP
9. Changes to governance rules
10. Changes to release-blocked task statuses

**No agent may bypass an approval gate by splitting a prohibited operation into smaller
tasks.**

## Relationship to existing enforcement (do not duplicate, do not weaken)

The Git subset of these gates is already enforced at the tool level by the live
`opencode.json` permissions:

- deny: `git push*`, `git reset --hard*`, `git clean -f*`, `git rebase*`, `git filter-branch*`
- ask: `git commit*`, `git add*`, `git merge*`

Standing Git rules live in `.opencode/specs/git-safety.md` and
`.kiro/steering/09_GIT_GOVERNANCE.md`; destructive database commands are additionally blocked
by the existing hook `.kiro/hooks/block-destructive-db-commands.kiro.hook`. This policy does
not replace any of these — it names the same gates as governance and adds the non-Git gates
(deploy, migrations, backend expansion, governance edits, status changes), which remain
enforced by review.

## Project-specific constraints preserved

- Frontend-first completion strategy remains active.
- Do not initiate backend implementation without explicit authorization.
- Preserve current protected WIP (see [legacy reference mapping](LEGACY_REFERENCE_MAPPING.md)).
- Preserve existing engineering/decision documentation and evidence.
- Preserve the currently authorized branch (session-specific; see mapping).
- Do not change PR or task statuses without evidence and approval.
- Preserve existing decision registers and their historical decisions (all four namespaces).

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-06
- `.opencode/specs/git-safety.md`
- `opencode.json` (unchanged)
