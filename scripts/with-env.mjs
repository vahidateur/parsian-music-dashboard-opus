#!/usr/bin/env node
/**
 * Runs a command with extra environment variables — a Windows-safe stand-in for
 * the POSIX-only `KEY=value command` prefix.
 *
 *   node scripts/with-env.mjs KEY=VALUE [KEY=VALUE ...] -- <command> [args...]
 *
 * `vite` is special-cased: it is launched as `node <vite cli>` (no shell, no
 * `.cmd` shim). Any other command is spawned directly with the given arguments.
 *
 * Exists because `APP_TARGET=client vite build` fails under cmd.exe
 * ("'APP_TARGET' is not recognized…"), which broke `npm run build:client` and
 * `npm run build:demo` on Windows. It adds no dependency and no third build
 * composition: the composition is still chosen only by `APP_TARGET` in
 * vite.config.ts.
 */
import { spawn } from "node:child_process";
import { resolveViteBin } from "./lib/vite-bin.mjs";

const argv = process.argv.slice(2);
const split = argv.indexOf("--");
if (split === -1 || split === argv.length - 1) {
  process.stderr.write("Usage: node scripts/with-env.mjs KEY=VALUE [...] -- <command> [args...]\n");
  process.exit(2);
}

const env = { ...process.env };
for (const pair of argv.slice(0, split)) {
  const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(pair);
  if (!match) {
    process.stderr.write(`with-env: "${pair}" is not KEY=VALUE\n`);
    process.exit(2);
  }
  env[match[1]] = match[2];
}

const [command, ...args] = argv.slice(split + 1);
let file = command;
let fileArgs = args;
if (command === "vite") {
  try {
    file = process.execPath;
    fileArgs = [resolveViteBin(), ...args];
  } catch (error) {
    process.stderr.write(`with-env: ${error.message}\n`);
    process.exit(1);
  }
}

const child = spawn(file, fileArgs, { env, stdio: "inherit" });
child.on("error", (error) => {
  process.stderr.write(`with-env: could not start "${command}": ${error.message}\n`);
  process.exit(1);
});
child.on("exit", (code, signal) => {
  process.exit(code ?? (signal ? 1 : 0));
});
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}