# Privacy and Data Classification Policy (AI-agent traffic)

**Status:** ACCEPTED governance (OCG-03) · **Recorded:** 2026-10-30
**Applies to:** what agents read, place in prompts, and send to external models/providers.
**Does not change:** `docs/engineering/DECISIONS.md` §17, which governs *product* privacy and
remains untouched.

## Data classification

| Class | Examples |
|---|---|
| **Public** | Public documentation, non-sensitive source code |
| **Internal** | Architecture, implementation details, internal task descriptions |
| **Confidential** | Credentials, API keys, tokens, private configuration, customer records, personal data, production secrets |

## Rules

1. Never send secrets or credentials to external models.
2. Never expose `.env`, private keys, access tokens, production credentials, or user records.
3. Apply least-context principles.
4. Send only the minimum files and excerpts necessary for a task.
5. Prefer providers with verified Zero Data Retention (ZDR) and no-training guarantees.
6. Treat privacy claims as provider-specific and subject to verification.
7. Do not assume ZDR means complete absence of operational logs.
8. If provider retention or training policies are unknown, classify the route as **UNVERIFIED**.
9. Require explicit approval before using unverified providers with Internal or Confidential
   information.
10. Keep local secrets outside version control.

## Enforcement model

None of these rules is executable configuration at this time; they are enforced through the
review and approval gates in [Agent Workflow and Approval Gates](AGENT_WORKFLOW_AND_APPROVAL_GATES.md)
(OCG-05/OCG-06). The repository's existing secret-hygiene enforcement (`.env` gitignored,
`DECISIONS.md` §17 tests such as `privacyPosture.test.ts`) continues to apply to source code
and is unaffected by this policy.

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-03
- `docs/engineering/DECISIONS.md` §17 — *Privacy is a product property* (unchanged)
- `docs/security.md`
