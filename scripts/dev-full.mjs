#!/usr/bin/env node
/**
 * Local integrated run: Laravel API + Vite (CLIENT composition), one command.
 *
 *   npm run dev:full
 *
 * Starts
 *   - the API:      PHP's built-in server (the framework's resources/server.php)
 *                     on 127.0.0.1:8080, cwd backend/public, with the panel's
 *                     upload ceilings set via -d (see the comment below —
 *                     `artisan serve` cannot pass them to the serving process)
 *   - the frontend: vite, with APP_TARGET=client and VITE_DATA_SOURCE=api
 *
 * The port is not arbitrary: vite.config.ts proxies /api to http://127.0.0.1:8080,
 * so the browser stays on the Vite origin (same-origin, no CORS). The client
 * composition has no local/demo repositories, so there is no silent fallback to
 * demo data — a domain the backend does not serve reports DOMAIN_UNAVAILABLE.
 *
 * What this script deliberately does NOT do: run migrations, run seeders, create
 * users, or touch the database in any way. The database and its users must
 * already exist.
 *
 * Zero dependencies; works on Windows (process trees are ended with taskkill)
 * and POSIX (process groups).
 */
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { resolveViteBin } from "./lib/vite-bin.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BACKEND = join(ROOT, "backend");
const IS_WINDOWS = process.platform === "win32";

const API_HOST = "127.0.0.1";
const API_PORT = 8080;
const API_URL = `http://${API_HOST}:${API_PORT}`;
const WEB_URL = "http://localhost:5173";

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;
const paint = (code, text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : text);
const TAGS = { api: paint("36", "[api]"), web: paint("35", "[web]"), dev: paint("33", "[dev]") };

const say = (tag, message) => process.stdout.write(`${TAGS[tag]} ${message}\n`);

/* ------------------------------------------------------------------ */
/* Preflight — fail early, with a reason a developer can act on         */
/* ------------------------------------------------------------------ */

function phpAvailable() {
  const result = spawnSync("php", ["-v"], { encoding: "utf8" });
  return !result.error && result.status === 0;
}

/** True when backend/.env defines a non-empty APP_KEY. The value is never printed. */
function appKeyPresent() {
  const file = join(BACKEND, ".env");
  if (!existsSync(file)) return false;
  const match = /^APP_KEY=(.*)$/m.exec(readFileSync(file, "utf8"));
  if (!match) return false;
  return match[1].trim().replace(/^["']|["']$/g, "").length > 0;
}

function portIsFree(port, host) {
  return new Promise((done) => {
    const probe = net.createServer();
    probe.once("error", () => done(false));
    probe.once("listening", () => probe.close(() => done(true)));
    probe.listen(port, host);
  });
}

async function preflight() {
  const problems = [];

  if (!phpAvailable()) {
    problems.push('PHP was not found on PATH ("php -v" failed). Install PHP 8.2+ or add it to PATH.');
  }
  if (!existsSync(join(BACKEND, "vendor", "autoload.php"))) {
    problems.push('backend/vendor is missing. Run "composer install" inside backend/.');
  }
  if (!existsSync(join(BACKEND, ".env"))) {
    problems.push('backend/.env is missing. Copy backend/.env.example to backend/.env and set your database.');
  } else if (!appKeyPresent()) {
    problems.push('APP_KEY is empty in backend/.env. Run "php artisan key:generate" inside backend/.');
  }
  try {
    resolveViteBin();
  } catch (error) {
    problems.push(error.message);
  }
  if (!(await portIsFree(API_PORT, API_HOST))) {
    // The built-in server would fail to bind and leave the Vite proxy pointing
    // at nothing — so refuse instead of drifting.
    problems.push(
      `Port ${API_PORT} on ${API_HOST} is already in use. Stop the process using it; the Vite proxy expects the API there.`,
    );
  }

  if (problems.length > 0) {
    say("dev", "Cannot start the integrated dev environment:");
    for (const problem of problems) process.stdout.write(`       - ${problem}\n`);
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Child processes                                                     */
/* ------------------------------------------------------------------ */

const children = [];
let shuttingDown = false;

/** Pipes a child's output line by line, each line carrying its service tag. */
function forward(stream, tag) {
  let pending = "";
  stream.setEncoding("utf8");
  stream.on("data", (chunk) => {
    pending += chunk;
    const lines = pending.split(/\r?\n/);
    pending = lines.pop() ?? "";
    for (const line of lines) if (line.length > 0) say(tag, line);
  });
  stream.on("end", () => {
    if (pending.length > 0) say(tag, pending);
  });
}

function start(tag, file, args, options) {
  const child = spawn(file, args, {
    ...options,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // A POSIX process group lets us end the whole tree; Windows uses taskkill /T.
    detached: !IS_WINDOWS,
  });
  forward(child.stdout, tag);
  forward(child.stderr, tag);
  const entry = { tag, child };
  children.push(entry);

  child.on("error", (error) => {
    say(tag, `failed to start: ${error.message}`);
    shutdown(1);
  });
  child.on("exit", (code, signal) => {
    entry.exited = true;
    if (shuttingDown) return;
    say("dev", `${tag} exited unexpectedly (${signal ?? `code ${code}`}); stopping everything.`);
    shutdown(code > 0 && code < 256 ? code : 1);
  });
  return entry;
}

function killTree(entry) {
  const { child } = entry;
  if (entry.exited || !child.pid) return;
  if (IS_WINDOWS) {
    spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    return;
  }
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    try {
      child.kill("SIGTERM");
    } catch {
      /* already gone */
    }
  }
}

function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  say("dev", "Stopping API and frontend…");
  for (const entry of children) killTree(entry);
  // Give the OS a moment to reap the trees, then leave regardless.
  const deadline = Date.now() + 5000;
  const wait = setInterval(() => {
    if (children.every((entry) => entry.exited) || Date.now() > deadline) {
      clearInterval(wait);
      process.exit(code);
    }
  }, 100);
}

for (const signal of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
  process.on(signal, () => shutdown(0));
}

/* ------------------------------------------------------------------ */
/* Run                                                                 */
/* ------------------------------------------------------------------ */

async function waitForApi() {
  const deadline = Date.now() + 60_000;
  while (!shuttingDown && Date.now() < deadline) {
    try {
      const response = await fetch(`${API_URL}/up`, { signal: AbortSignal.timeout(1500) });
      if (response.ok) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((done) => setTimeout(done, 500));
  }
  return false;
}

await preflight();

say("dev", "Starting Laravel API and the Vite client composition…");

/*
 * The dev API must accept what the panel allows. The product's upload caps
 * live in src/domains/media/types.ts (MAX_IMAGE_BYTES 5 MB, MAX_AUDIO_BYTES
 * 25 MB, MAX_DOCUMENT_BYTES 20 MB); PHP's stock ini allows 2 MB per upload,
 * which would refuse a photo the panel offered to take and hand the user a
 * confusing error instead of the file's own.
 *
 * WHY NOT `php -d … artisan serve`: `artisan serve` spawns `php -S …` as a
 * CHILD process, and `-d` modifies only the PARENT's ini — the child comes up
 * with the stock limits anyway (verified by probe). So this script starts the
 * SAME built-in server (the framework's own `resources/server.php`, cwd
 * `backend/public`, the same command ServeCommand builds) with the limits on
 * the serving process itself.
 *
 * A deployment must set the same ceilings in its own php.ini — see
 * deploy/nginx.conf's client_max_body_size, which must stay consistent with it.
 */
const PHP_UPLOAD_LIMITS = [
  "-d",
  "upload_max_filesize=25M",
  "-d",
  "post_max_size=26M",
];
const PHP_SERVER_SCRIPT = join(
  BACKEND,
  "vendor",
  "laravel",
  "framework",
  "src",
  "Illuminate",
  "Foundation",
  "resources",
  "server.php",
);

start("api", "php", [...PHP_UPLOAD_LIMITS, "-S", `${API_HOST}:${API_PORT}`, PHP_SERVER_SCRIPT], {
  cwd: join(BACKEND, "public"),
  env: process.env,
});

start("web", process.execPath, [resolveViteBin()], {
  cwd: ROOT,
  env: {
    ...process.env,
    // Build-time composition and data source for THIS run. The client composition
    // physically excludes every demo/local repository (see vite.config.ts).
    APP_TARGET: "client",
    VITE_DATA_SOURCE: "api",
    // Keep the base relative so every call goes through the Vite proxy.
    VITE_API_BASE_URL: "/api/v1",
  },
});

if (await waitForApi()) {
  say("dev", "");
  say("dev", `Frontend : ${WEB_URL}   (Vite prints the exact URL if that port was taken)`);
  say("dev", `API      : ${API_URL}/api/v1   (health: ${API_URL}/up)`);
  say("dev", "Composition: client (APP_TARGET=client, VITE_DATA_SOURCE=api) — no demo/local fallback.");
  say("dev", "This command does not migrate, seed, or create users; sign-in needs an existing user.");
  say("dev", "Press Ctrl+C to stop both.");
  say("dev", "");
} else if (!shuttingDown) {
  say("dev", `The API did not answer ${API_URL}/up within 60s. Check the [api] output above.`);
}