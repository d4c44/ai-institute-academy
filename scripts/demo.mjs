// Runs Next.js in demo mode: the site answers its own /api/v1/* from memory, so neither the Go API
// nor PostgreSQL is needed. DEMO_MODE decides the API routing at build time, so build with it too.
//
//   node scripts/demo.mjs dev      (npm run dev:demo)
//   node scripts/demo.mjs build    (npm run build:demo)
//   node scripts/demo.mjs start    (npm run start:demo)
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const next = require.resolve("next/dist/bin/next");
const [, , command = "dev", ...args] = process.argv;

const child = spawn(process.execPath, [next, command, ...args], {
  stdio: "inherit",
  env: { ...process.env, DEMO_MODE: "1" },
});
child.on("exit", (code, signal) => process.exit(code ?? (signal ? 1 : 0)));
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => child.kill(sig));