import { createRequire } from "node:module";
import { createServer } from "node:http";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const coreRoot = process.env.REENTRY_CONFORMANCE_ROOT;
if (typeof coreRoot !== "string" || coreRoot.length === 0) {
  throw profileError("standing_receiver_process_core_root_missing");
}
const { serveProfileProcess } = await import(
  pathToFileURL(join(coreRoot, "reentry-core/conformance/process-rpc.mjs")).href,
);

let runtime;
const effects = new Map();

serveProfileProcess({
  start(input) {
    if (runtime) throw profileError("standing_receiver_process_already_started");
    requireStartInput(input);
    process.env.NODE_ENV = "test";
    process.env.DATABASE_URL = input.databaseUrl;
    process.env.CLOUD_RECEIVER_RUNTIME_DATABASE_URL = input.databaseUrl;
    process.env.DIRECT_URL = input.databaseUrl;
    process.env.PORT = "0";
    process.env.RECEIVER_PUBLIC_URL = "http://127.0.0.1";
    process.env.FRONTEND_URL = "http://127.0.0.1:3000";
    process.env.COOKIE_DOMAIN = "";
    process.env.TS_NODE_PROJECT = join(input.backendRoot, "tsconfig.json");

    const require = createRequire(import.meta.url);
    require("ts-node/register/transpile-only");
    const { createApp } = require(join(input.backendRoot, "src/app.ts"));
    const { appConfig } = require(join(input.backendRoot, "src/config/config.ts"));
    const { prisma } = require(join(input.backendRoot, "src/db/index.ts"));
    const app = createApp();
    app.locals.standingEffectAuthority = {
      verifyEffect({ effectToken, expected }) {
        const effect = effects.get(effectToken);
        if (!effect) throw new Error("unknown standing effect token");
        for (const field of [
          "delivery_id",
          "event_id",
          "correlation_id",
          "workflow_id",
          "outcome",
        ]) {
          if (effect[field] !== expected[field]) {
            throw new Error("standing effect context mismatch");
          }
        }
        return effect;
      },
    };
    const server = createServer(app);
    return new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        appConfig.receiverPublicUrl = `http://127.0.0.1:${server.address().port}`;
        effects.clear();
        runtime = { app, prisma, server };
        resolve({
          pid: process.pid,
          port: server.address().port,
          sqliteLoaded: false,
        });
      });
    });
  },

  authorizeEffect({ effectToken, effect }) {
    requireRuntime();
    effects.set(effectToken, effect);
    return { authorized: true };
  },

  crash() {
    requireRuntime();
    process.kill(process.pid, "SIGKILL");
    throw profileError("standing_receiver_process_crash_not_terminated");
  },

  async stop() {
    await closeRuntime();
    return { stopped: true };
  },
});

async function closeRuntime() {
  if (!runtime) return;
  const current = runtime;
  runtime = undefined;
  effects.clear();
  current.server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    current.server.close((error) => (error ? reject(error) : resolve()));
  });
  await current.prisma.$disconnect();
}

function requireRuntime() {
  if (!runtime) throw profileError("standing_receiver_process_not_started");
}

function requireStartInput(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw profileError("standing_receiver_process_start_invalid");
  }
  for (const field of ["databaseUrl", "backendRoot"]) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw profileError("standing_receiver_process_start_invalid");
    }
  }
}

function profileError(code) {
  return Object.assign(new Error(code), { code });
}
