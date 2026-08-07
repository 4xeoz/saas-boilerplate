import { createApp } from "./app";
import { appConfig } from "./config/config";
import { pool } from "./db";
import { authService } from "./modules/authentication/auth.service";

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // hourly
const SHUTDOWN_TIMEOUT_MS = 10 * 1000;

const app = createApp();

const server = app.listen(appConfig.port, () => {
  console.log(`Backend listening on http://localhost:${appConfig.port}`);
});

/**
 * Delete expired refresh tokens on a timer.
 *
 * A failure here must never take the process down, so the promise is caught
 * and logged. unref() lets Node exit even while this timer is pending, so a
 * scheduled cleanup cannot delay shutdown.
 */
async function cleanupExpiredTokens() {
  try {
    const deleted = await authService.deleteExpiredTokens();
    if (deleted > 0) {
      console.log(`[cleanup] deleted ${deleted} expired refresh token(s)`);
    }
  } catch (error) {
    console.error("[cleanup] failed:", error);
  }
}

const cleanupTimer = setInterval(cleanupExpiredTokens, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();
cleanupExpiredTokens();

/**
 * Graceful shutdown.
 *
 * Docker sends SIGTERM and waits about ten seconds before SIGKILL. Without a
 * handler the default is to die instantly, cutting off in-flight requests and
 * leaving the database to clean up abandoned connections.
 *
 * server.close() stops accepting new connections but lets running requests
 * finish, then the pool is drained. The timer is the backstop for a request
 * that never completes, so shutdown cannot hang forever.
 */
let isShuttingDown = false;

async function shutdown(signal: string) {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;
  console.log(`${signal} received, shutting down...`);

  clearInterval(cleanupTimer);

  const forceExit = setTimeout(() => {
    console.error("Shutdown timed out, forcing exit.");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  server.close(async () => {
    try {
      await pool.end();
      console.log("Shutdown complete.");
    } catch (error) {
      console.error("Error closing the database pool:", error);
    }
    clearTimeout(forceExit);
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
