# Token and Context Efficiency Policy (low-consumption engineering)

**Status:** ACCEPTED governance (OCG-04) · **Recorded:** 2026-10-30
**Applies to:** all agent work in this repository.
**Relationship to existing rules:** formalizes principles already stated in `AGENTS.md`
("narrow reads", "reuse verified command results", "focused tests first") — it does not
replace them; where both apply, the stricter constraint governs.

## Context efficiency

- Inspect relevant files before reading entire directories.
- Reuse existing evidence and previous test results where still valid (**Evidence Reuse
  First**).
- Avoid repeated repository-wide analysis.
- Avoid unnecessary full-context uploads.
- Do not repeatedly ask models to regenerate already-accepted plans.
- Keep task prompts narrowly scoped.
- Use concise outputs unless detailed analysis is necessary.

## Model efficiency

- Primary model handles routine implementation.
- Fallback model is used only when necessary.
- Complex Coding model is reserved for genuinely complex tasks.
- Architecture Review model is reserved for consequential decisions.
- Do not use multiple models for simple tasks without a clear justification.
- Avoid parallel agents modifying shared files.

## Test efficiency

- Run targeted tests first.
- Run lint and type checks relevant to modified files.
- Run the full test suite at appropriate integration and release gates.
- Reuse valid previous test evidence.
- **Never claim tests passed without actual execution evidence.**

## Relationship to privacy

Least-context composition (this policy) and least-data rules (the
[privacy policy](PRIVACY_AND_DATA_CLASSIFICATION_POLICY.md)) reinforce each other. Efficiency
is never a justification for including more files than necessary.

## Related

- [GOVERNANCE_DECISION_REGISTER.md](GOVERNANCE_DECISION_REGISTER.md) → OCG-04
- `AGENTS.md` — *Working rules* (unchanged)
- [Model Routing Policy](MODEL_ROUTING_POLICY.md)
