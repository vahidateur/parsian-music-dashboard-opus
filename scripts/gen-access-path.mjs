#!/usr/bin/env node
/**
 * Generates a secret access path for a private deployment.
 *
 * Usage:  npm run gen:access-path
 *
 * 16 random bytes → 32 hex characters ≈ 128 bits. Brute-forcing that over a
 * network, behind rate limiting, is not a realistic attack.
 */
import { randomBytes } from "node:crypto";

const slug = randomBytes(16).toString("hex");

process.stdout.write(`
Add this to your .env (never commit it):

  VITE_ACCESS_PATH=${slug}

The panel will then be reachable ONLY at:

  https://<your-host>/${slug}/

Reminder: this is obscurity, not security. It keeps opportunistic scanners and
crawlers away so the panel never lands in an index or a dataset. Authentication
and server-side authorization remain the controls that actually protect data.

Enforce the same path at the edge (see deploy/nginx.conf) so a wrong URL never
even receives the JavaScript bundle.

`);
