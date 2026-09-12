/**
 * Renders children only when the secret access path is satisfied.
 *
 * The decoy shown otherwise is deliberately indistinguishable from an empty
 * server: no branding, no Persian text, no "access denied" wording, no product
 * name, no styling that could be fingerprinted. A scanner that hits the wrong
 * URL should conclude there is nothing here — an "unauthorized" page confirms
 * that something worth attacking exists.
 *
 * See `accessPath.ts` for why this is obscurity rather than security, and why
 * it is still worth having.
 */
import type { ReactNode } from "react";
import { evaluateAccessPath } from "./accessPath";

export function AccessGate({ children }: { children: ReactNode }) {
  const state = evaluateAccessPath();

  if (state.misconfigured) {
    // Fail loudly for the OPERATOR, not the visitor. A weak slug silently
    // accepted would be the worst outcome — it looks protected and is not.
    // This branch is unreachable in a correctly built deployment.
    if (import.meta.env.DEV) {
      return (
        <main style={shellStyle}>
          <pre style={{ maxWidth: 560, whiteSpace: "pre-wrap", color: "#e0645a", fontSize: 13 }}>
            {state.misconfigured}
          </pre>
        </main>
      );
    }
    return <NotFound />;
  }

  if (!state.granted) return <NotFound />;
  return <>{children}</>;
}

/**
 * A plain 404 body.
 *
 * Matches what a bare nginx/Caddy returns for a missing file. No inline
 * <style>, no fonts, no assets — nothing to correlate one deployment with
 * another.
 */
function NotFound() {
  return (
    <main style={shellStyle}>
      <h1 style={{ fontSize: 24, fontWeight: 400, margin: 0 }}>404 Not Found</h1>
    </main>
  );
}

const shellStyle: React.CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  alignItems: "center",
  justifyContent: "center",
  background: "#fff",
  color: "#000",
  fontFamily: "system-ui, sans-serif",
};
