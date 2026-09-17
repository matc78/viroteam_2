/**
 * Lance `next dev` avec logs d'arrêt (code, signal) pour diagnostiquer
 * les sorties silencieuses (souvent Turbopack sur Windows).
 *
 * Usage: node scripts/dev-with-logs.mjs [--webpack]
 */
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const portalRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const useWebpack = process.argv.includes("--webpack");

const nextArgs = ["dev"];
if (!useWebpack) {
  nextArgs.push("--turbopack");
}

process.env.NEXT_TELEMETRY_DEBUG ??= "1";
process.env.NEXT_TURBOPACK_TRACING ??= useWebpack ? "0" : "1";
process.env.NODE_OPTIONS = [
  process.env.NODE_OPTIONS,
  "--trace-uncaught",
  "--trace-warnings",
  "--trace-exit",
]
  .filter(Boolean)
  .join(" ");

const nextBin = path.join(portalRoot, "node_modules", "next", "dist", "bin", "next");

console.log("[dev] cwd:", portalRoot);
console.log("[dev] bundler:", useWebpack ? "webpack" : "turbopack");
console.log("[dev] node:", process.version, process.arch);
console.log("[dev] NODE_OPTIONS:", process.env.NODE_OPTIONS);
console.log("[dev] NEXT_TURBOPACK_TRACING:", process.env.NEXT_TURBOPACK_TRACING);
console.log("[dev] starting: next", nextArgs.join(" "));

const child = spawn(process.execPath, [nextBin, ...nextArgs], {
  cwd: portalRoot,
  stdio: "inherit",
  env: process.env,
});

const logStop = (reason, detail) => {
  console.error("\n[dev] ── process arrêté ──");
  console.error(`[dev] raison: ${reason}`, detail ?? "");
  console.error(`[dev] bundler: ${useWebpack ? "webpack" : "turbopack"}`);
  console.error(
    "[dev] si sortie pendant « Compiling … » sans stack : tester `npm run dev:webpack`",
  );
  if (!useWebpack) {
    console.error(
      "[dev] trace Turbopack éventuelle: portal/.next/dev/trace-turbopack",
    );
  }
};

child.on("error", (error) => {
  logStop("spawn error", error);
  process.exit(1);
});

child.on("exit", (code, signal) => {
  if (signal) {
    logStop("signal", signal);
    process.exit(1);
  }
  logStop("exit code", code);
  process.exit(code ?? 1);
});

for (const signal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(signal, () => {
    console.error(`\n[dev] reçu ${signal} — arrêt demandé`);
    child.kill(signal);
  });
}
