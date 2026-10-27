---
name: Runtime Verify
description: Verify the running application and produce evidence - dev server, HTTP checks, login, and the specific page or flow under review. Use when asked to check the app, a page, a flow or the browser, or to confirm a fix in the real runtime. Triggers - "run the app", "check the page", "in the browser", "does it work live", "open the app", "verify at runtime".
---

# Runtime verify

Run it, look at it, and report **what the runtime showed** — never what you expect it to
show. A claim of browser verification is a claim about an observation you actually made.

## When to use

- The owner asks to see the app, a page or a flow.
- A fix must be confirmed outside the unit-test world.
- Before deciding that something is user-visible-broken.

## Minimum context to load

1. This skill.
2. `.opencode/specs/api-capability-errors.md` — so a missing capability is not read as a
   bug.
3. Nothing else until the runtime tells you what is relevant.

## Procedure

1. **Start (or reuse) the dev server.** It serves the **demo** composition; no backend is
   needed for it.

   ```bash
   npm run dev -- --host --port 5173 --strictPort
   ```

   Check it answers: `curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:5173/`
   → expect `200`.

   For the client composition you need PHP + Composer + MySQL, which this machine does not
   have. Say so instead of substituting the demo build.

2. **State the target and the entry point** in the report: which composition, which URL,
   which account (`admin@demo.local` / `arena-demo` in the demo).

3. **Observe, do not assume.** If a browser is available, use it and record what rendered.
   If it is not, say exactly what you could verify over HTTP (status, title, assets served)
   and mark browser QA as **NOT VERIFIED** — the project's standing rule.

4. **Check the specific flow, not the whole app.** Name the page or action, then check the
   thing the owner cares about: the write that must happen, the message that must appear,
   the record that must appear.

5. **Watch the server log** for errors while you exercise the flow.

6. **Leave the server running** if the owner is about to look at it, and give them the URL.

## Stop conditions

- The server does not start → diagnose (port, missing native package, Node version) and
  report; do not claim the app works.
- A flow needs the backend → report it as untestable here and why.
- A page renders a capability wall → that may be correct (see the capability spec); check
  the spec before calling it a bug.

## Definition of done

- [ ] Server started (or confirmed already running) and answering.
- [ ] Target, URL and account stated.
- [ ] The specific flow checked, with the observed result quoted.
- [ ] Browser QA marked VERIFIED **only** if a browser actually rendered it; otherwise
  explicitly NOT VERIFIED.
- [ ] Server left running with the URL reported.

## Output format

```
RUNTIME    — target, URL, account, server status
OBSERVED   — what the runtime actually showed (quoted output, not paraphrase)
CHECKED    — the flow/page and the expected-vs-actual
NOT VERIFIED — anything that could not be observed, and why
NEXT       — one concrete next action, or "none"
```
