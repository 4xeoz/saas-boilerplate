import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MIGRATIONS, requireUpgradeConfiguration, verifyMigrationRecords } from "./migration-upgrade.mjs";

const environment = {
  NODE_ENV: "test",
  STANDING_MIGRATION_RECEIVER_COMMIT: "a".repeat(40),
  STANDING_MIGRATION_LOCK_SHA256: "b".repeat(64),
  STANDING_UPGRADE_DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:55433/reentry_closure",
};

test("upgrade guard requires a full Receiver commit and expected dependency lock", () => {
  assert.equal(requireUpgradeConfiguration(environment).commit, environment.STANDING_MIGRATION_RECEIVER_COMMIT);
  for (const commit of [undefined, "main", "a".repeat(7), "A".repeat(40)]) {
    assert.throws(() => requireUpgradeConfiguration({ ...environment, STANDING_MIGRATION_RECEIVER_COMMIT: commit }),
      { code: "upgrade_exact_receiver_commit_required" });
  }
  assert.throws(() => requireUpgradeConfiguration({ ...environment, STANDING_MIGRATION_LOCK_SHA256: undefined }),
    { code: "upgrade_expected_lock_sha256_required" });
  assert.throws(() => requireUpgradeConfiguration({ ...environment, NODE_ENV: "production" }),
    { code: "upgrade_requires_node_env_test" });
});

test("upgrade guard accepts only the explicit new disposable endpoint without transport overrides", () => {
  for (const database of [
    "postgresql://fixture@localhost:55433/reentry_closure",
    "postgresql://fixture@127.0.0.1:55432/reentry_baseline",
    "postgresql://fixture@127.0.0.1:55433/production",
    "postgresql://fixture@127.0.0.1:55433/reentry_closure?host=remote.example",
    "postgresql://fixture@127.0.0.1:55433/reentry_closure#override",
    "https://127.0.0.1:55433/reentry_closure",
  ]) {
    assert.throws(() => requireUpgradeConfiguration({ ...environment, STANDING_UPGRADE_DATABASE_URL: database }),
      { code: "upgrade_requires_exact_disposable_database" });
  }
  assert.throws(() => requireUpgradeConfiguration({ ...environment, STANDING_UPGRADE_DATABASE_URL: undefined }),
    { code: "upgrade_database_url_invalid" });
});

function migrationFixture() {
  const bytes = new Map(MIGRATIONS.map(name => [
    `backend/prisma/migrations/${name}/migration.sql`, Buffer.from(`Synthetic checksum fixture ${name}`),
  ]));
  const rows = MIGRATIONS.map(name => ({
    migration_name: name,
    checksum: createHash("sha256").update(bytes.get(`backend/prisma/migrations/${name}/migration.sql`)).digest("hex"),
    finished: true, rolled_back: false, applied_steps_count: 1,
  }));
  return { bytes, rows };
}

test("migration records require exactly the selected committed names and SQL checksums", () => {
  const { bytes, rows } = migrationFixture();
  verifyMigrationRecords(rows, MIGRATIONS, bytes);
  verifyMigrationRecords(rows.slice(0, 6), MIGRATIONS.slice(0, 6), bytes);
  assert.throws(() => verifyMigrationRecords(rows.slice(0, 6), MIGRATIONS, bytes),
    /upgrade_applied_migration_inventory_mismatch/);
  assert.throws(() => verifyMigrationRecords([...rows, rows[6]], MIGRATIONS, bytes),
    /upgrade_applied_migration_inventory_mismatch/);
  assert.throws(() => verifyMigrationRecords(rows.map((row, index) => index === 6
    ? { ...row, checksum: "0".repeat(64) } : row), MIGRATIONS, bytes),
  /upgrade_applied_migration_checksum_mismatch/);
});

test("migration records reject incomplete, rolled-back, or zero-step results", () => {
  const { bytes, rows } = migrationFixture();
  for (const change of [{ finished: false }, { rolled_back: true }, { applied_steps_count: 0 }]) {
    assert.throws(() => verifyMigrationRecords(rows.map((row, index) => index === 6
      ? { ...row, ...change } : row), MIGRATIONS, bytes));
  }
});

test("actual upgrade entrypoint refuses an unavailable commit before database access", () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL("./migration-upgrade.mjs", import.meta.url))], {
    env: { ...process.env, ...environment, STANDING_MIGRATION_RECEIVER_COMMIT: "0".repeat(40) },
    encoding: "utf8", timeout: 10_000,
  });
  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.equal(result.stderr.trim(), "upgrade_source_git_invalid");
  assert.ok(!result.stderr.includes("fixture:fixture"));
});
