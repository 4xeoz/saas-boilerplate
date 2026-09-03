import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, realpath, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS = Object.freeze([
  "20260902000000_init_cloud_receiver_2_auth",
  "20260902010000_pairing",
  "20260902020000_consent_targeting",
  "20260902030000_signed_event_ingress",
  "20260902040000_delivery_claim_lease",
  "20260902050000_delivery_acknowledgement",
  "20260903193000_standing_authorization_v02",
]);
const PREFIX = "backend/prisma/migrations";
const SENTINEL_HELPER = "backend/src/modules/standing/test/standing-migration-sentinel.ts";
const MIGRATION_TEST = "backend/src/modules/standing/test/standing-migration.test.ts";
const SOURCE_PATHS = [
  "package.json", "package-lock.json", "backend/package.json",
  "backend/prisma/schema.prisma", "backend/prisma/migrations/migration_lock.toml",
  "backend/jest.config.js", "backend/tsconfig.json", "backend/tsconfig.test.json",
  "backend/src/test/setup.ts", "backend/src/db/index.ts", "backend/src/config/config.ts",
  SENTINEL_HELPER, MIGRATION_TEST,
  "backend/conformance/standing-v0.2/migration-upgrade.mjs",
  ...MIGRATIONS.map(name => `${PREFIX}/${name}/migration.sql`),
];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");

function git(root, args) {
  try {
    return execFileSync("git", ["-C", root, ...args], {
      env: {
        ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
        GIT_NO_REPLACE_OBJECTS: "1",
      },
      stdio: ["ignore", "pipe", "pipe"], maxBuffer: 16 * 1024 * 1024,
    });
  } catch { fail("upgrade_source_git_invalid"); }
}

export function requireUpgradeConfiguration(env) {
  if (env.NODE_ENV !== "test") fail("upgrade_requires_node_env_test");
  if (!/^[a-f0-9]{40}$/.test(env.STANDING_MIGRATION_RECEIVER_COMMIT ?? "")) {
    fail("upgrade_exact_receiver_commit_required");
  }
  if (!/^[a-f0-9]{64}$/.test(env.STANDING_MIGRATION_LOCK_SHA256 ?? "")) {
    fail("upgrade_expected_lock_sha256_required");
  }
  let database;
  try { database = new URL(env.STANDING_UPGRADE_DATABASE_URL); }
  catch { fail("upgrade_database_url_invalid"); }
  if (!["postgres:", "postgresql:"].includes(database.protocol) ||
      database.hostname !== "127.0.0.1" || database.port !== "55433" ||
      database.pathname !== "/reentry_closure" || database.search || database.hash) {
    fail("upgrade_requires_exact_disposable_database");
  }
  return {
    commit: env.STANDING_MIGRATION_RECEIVER_COMMIT,
    lockSha256: env.STANDING_MIGRATION_LOCK_SHA256,
    databaseUrl: database.href,
  };
}

async function committedSources(root, configuration) {
  if (git(root, ["rev-parse", "--show-toplevel"]).toString().trim() !== root ||
      git(root, ["cat-file", "-t", configuration.commit]).toString().trim() !== "commit") {
    fail("upgrade_source_commit_invalid");
  }
  const migrationInventory = git(root, ["ls-tree", "-r", "--name-only", configuration.commit, "--", PREFIX])
    .toString().trim().split("\n").filter(path => path.endsWith("/migration.sql"));
  assert.deepEqual(migrationInventory, MIGRATIONS.map(name => `${PREFIX}/${name}/migration.sql`),
    "upgrade_migration_inventory_mismatch");
  const bytes = new Map();
  for (const path of SOURCE_PATHS) {
    let current = root;
    for (const component of path.split("/")) {
      current = join(current, component);
      if ((await lstat(current)).isSymbolicLink()) fail("upgrade_source_symlink_forbidden");
    }
    const entry = git(root, ["ls-tree", configuration.commit, "--", path]).toString();
    if (!/^100(?:644|755) blob [a-f0-9]{40}\t/.test(entry)) fail("upgrade_source_file_not_committed");
    const committed = git(root, ["show", `${configuration.commit}:${path}`]);
    if (!(await readFile(current)).equals(committed)) fail("upgrade_source_bytes_mismatch");
    bytes.set(path, committed);
  }
  if (sha256(bytes.get("package-lock.json")) !== configuration.lockSha256) {
    fail("upgrade_dependency_lock_mismatch");
  }
  return bytes;
}

export function verifyMigrationRecords(rows, names, sourceBytes) {
  assert.deepEqual(rows.map(row => row.migration_name), names, "upgrade_applied_migration_inventory_mismatch");
  for (const row of rows) {
    assert.equal(row.checksum, sha256(sourceBytes.get(`${PREFIX}/${row.migration_name}/migration.sql`)),
      "upgrade_applied_migration_checksum_mismatch");
    assert.equal(row.finished, true, "upgrade_migration_unfinished");
    assert.equal(row.rolled_back, false, "upgrade_migration_rolled_back");
    assert.ok(row.applied_steps_count > 0, "upgrade_migration_steps_missing");
  }
}

async function migrationRecords(client) {
  return (await client.query(`SELECT migration_name, checksum, finished_at IS NOT NULL AS finished,
    rolled_back_at IS NOT NULL AS rolled_back, applied_steps_count
    FROM public._prisma_migrations ORDER BY migration_name`)).rows;
}

async function baselineSnapshot(client) {
  const tables = (await client.query(`SELECT c.relname, c.relrowsecurity, c.relforcerowsecurity,
    pg_get_userbyid(c.relowner) AS owner, c.relacl::text AS acl
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r'
    AND c.relname LIKE 'cr2_%' AND c.relname NOT LIKE 'cr2_standing_%' ORDER BY c.relname`)).rows;
  const names = tables.map(table => table.relname);
  const columns = (await client.query(`SELECT c.relname, a.attname, a.attnum,
    format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull, a.attidentity, a.attgenerated,
    pg_get_expr(d.adbin, d.adrelid) AS default_expression
    FROM pg_class c JOIN pg_attribute a ON a.attrelid = c.oid
    LEFT JOIN pg_attrdef d ON d.adrelid = c.oid AND d.adnum = a.attnum
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[])
    AND a.attnum > 0 AND NOT a.attisdropped ORDER BY c.relname, a.attnum`, [names])).rows;
  const indexes = (await client.query(`SELECT tablename, indexname, indexdef FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = ANY($1::text[]) ORDER BY tablename, indexname`, [names])).rows;
  const constraints = (await client.query(`SELECT c.relname, k.conname, k.contype, k.convalidated,
    pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid = k.conrelid
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[])
    ORDER BY c.relname, k.conname`, [names])).rows;
  // New standing foreign keys have internal triggers on existing parent tables.
  // Compare user-defined baseline triggers, not that intended referential linkage.
  const triggers = (await client.query(`SELECT c.relname, t.tgname, t.tgenabled,
    pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relnamespace = 'public'::regnamespace AND c.relname = ANY($1::text[])
    AND NOT t.tgisinternal ORDER BY c.relname, t.tgname`, [names])).rows;
  const policies = (await client.query(`SELECT * FROM pg_policies WHERE schemaname = 'public'
    AND tablename = ANY($1::text[]) ORDER BY tablename, policyname`, [names])).rows;
  const rows = {};
  for (const name of names) {
    assert.match(name, /^cr2_[a-z0-9_]+$/, "upgrade_snapshot_table_name_invalid");
    rows[name] = (await client.query(`SELECT to_jsonb(t)::text AS value FROM public."${name}" t
      ORDER BY to_jsonb(t)::text COLLATE "C"`)).rows.map(row => row.value);
  }
  return { schema: { tables, columns, indexes, constraints, triggers, policies }, rows };
}

function runTool(root, executable, args, environment, code) {
  try {
    return execFileSync(process.execPath, [executable, ...args], {
      cwd: root, env: environment, stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000, maxBuffer: 8 * 1024 * 1024,
    });
  } catch { fail(code); }
}

export async function rehearseMigrationUpgrade() {
  const configuration = requireUpgradeConfiguration(process.env);
  const receiverRoot = await realpath(fileURLToPath(new URL("../../../", import.meta.url)));
  const sourceBytes = await committedSources(receiverRoot, configuration);
  if (process.versions.node.split(".")[0] !== "24") fail("upgrade_requires_node_24");
  const require = createRequire(import.meta.url);
  // Source and configuration gates above precede pg loading or database access.
  const { Client } = require("pg");
  const client = new Client({ connectionString: configuration.databaseUrl });
  const environment = {
    ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("PG"))),
    NODE_ENV: "test", DATABASE_URL: configuration.databaseUrl,
    DIRECT_URL: configuration.databaseUrl, CLOUD_RECEIVER_RUNTIME_DATABASE_URL: configuration.databaseUrl,
    STANDING_MIGRATION_TEST_DATABASE_URL: configuration.databaseUrl,
    TS_NODE_PROJECT: join(receiverRoot, "backend/tsconfig.json"),
  };
  let workspace;
  try {
    await client.connect();
    const identity = (await client.query(`SELECT current_database() AS database,
      inet_server_addr()::text AS address, current_setting('server_version_num') AS version`)).rows[0];
    assert.equal(identity.database, "reentry_closure", "upgrade_database_identity_mismatch");
    assert.ok(identity.address !== null, "upgrade_requires_tcp_database");
    const occupied = (await client.query(`SELECT n.nspname, c.relname FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')`)).rows;
    assert.deepEqual(occupied, [], "upgrade_requires_new_empty_database_no_reset_allowed");
    workspace = await mkdtemp(join(tmpdir(), "standing-migration-upgrade-"));
    async function put(path, bytes) {
      const target = join(workspace, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, bytes, { flag: "wx" });
    }
    await put("prisma/schema.prisma", sourceBytes.get("backend/prisma/schema.prisma"));
    await put("prisma/migrations/migration_lock.toml", sourceBytes.get(`${PREFIX}/migration_lock.toml`));
    await put("prisma.config.mjs", `export default {
      schema: ${JSON.stringify(join(workspace, "prisma/schema.prisma"))},
      migrations: {path: ${JSON.stringify(join(workspace, "prisma/migrations"))}},
      datasource: {url: process.env.DIRECT_URL}
    };\n`);
    for (const name of MIGRATIONS.slice(0, 6)) {
      await put(`prisma/migrations/${name}/migration.sql`, sourceBytes.get(`${PREFIX}/${name}/migration.sql`));
    }
    const prismaCli = require.resolve("prisma/build/index.js");
    const deploy = () => runTool(workspace, prismaCli,
      ["migrate", "deploy", "--config", join(workspace, "prisma.config.mjs")], environment, "upgrade_migrate_deploy_failed");
    deploy();
    verifyMigrationRecords(await migrationRecords(client), MIGRATIONS.slice(0, 6), sourceBytes);
    process.env.TS_NODE_PROJECT = environment.TS_NODE_PROJECT;
    require("ts-node/register/transpile-only");
    const { seedV01UpgradeSentinel } = require(join(receiverRoot, SENTINEL_HELPER));
    await seedV01UpgradeSentinel(client);
    const before = await baselineSnapshot(client);
    assert.equal(before.rows.cr2_grants?.length, 1, "upgrade_sentinel_grant_missing");
    assert.equal(before.rows.cr2_events?.length, 1, "upgrade_sentinel_event_missing");
    assert.equal(before.rows.cr2_deliveries?.length, 1, "upgrade_sentinel_delivery_missing");
    await put("baseline-snapshot.json", JSON.stringify(before, null, 2));
    const standing = MIGRATIONS[6];
    await put(`prisma/migrations/${standing}/migration.sql`, sourceBytes.get(`${PREFIX}/${standing}/migration.sql`));
    deploy();
    // Critically, no post-upgrade seeder or regression suite runs before this comparison.
    const after = await baselineSnapshot(client);
    await put("upgraded-snapshot.json", JSON.stringify(after, null, 2));
    assert.deepEqual(after, before, "upgrade_changed_existing_v01_rows_or_schema");
    const applied = await migrationRecords(client);
    verifyMigrationRecords(applied, MIGRATIONS, sourceBytes);
    // Reuse the existing runtime constraint probes only after preservation is proven.
    runTool(join(receiverRoot, "backend"), require.resolve("jest/bin/jest"), [
      "--runInBand", "--runTestsByPath", "src/modules/standing/test/standing-migration.test.ts",
      "--json", "--outputFile", join(workspace, "constraint-results.json"),
    ], environment, "upgrade_constraint_suite_failed");
    const constraints = JSON.parse(await readFile(join(workspace, "constraint-results.json"), "utf8"));
    assert.equal(constraints.success, true, "upgrade_constraint_results_failed");
    assert.equal(constraints.numPassedTests, 6, "upgrade_constraint_test_count_changed");
    assert.equal(constraints.numPendingTests, 0, "upgrade_constraint_tests_skipped");
    assert.deepEqual(await baselineSnapshot(client), before, "upgrade_probes_changed_existing_v01_rows_or_schema");
    verifyMigrationRecords(await migrationRecords(client), MIGRATIONS, sourceBytes);
    await committedSources(receiverRoot, configuration);
    const evidence = {
      status: "passed", profile: "local-exact-source-migration-upgrade",
      receiver_commit: configuration.commit, dependency_lock_sha256: configuration.lockSha256,
      node: process.version, postgres_version_num: identity.version,
      migrations: applied, baseline_tables: before.schema.tables.length,
      baseline_row_count: Object.values(before.rows).reduce((sum, rows) => sum + rows.length, 0),
      baseline_snapshot_sha256: sha256(JSON.stringify(before)),
      v01_rows_and_catalog_preserved: true, preservation_checked_before_post_upgrade_seeding: true,
      constraint_tests_passed: constraints.numPassedTests, retained_workspace: workspace,
      release_conformance_verified: false, production_migration: false,
    };
    await put("result.json", JSON.stringify(evidence, null, 2));
    return evidence;
  } finally {
    await client.end();
    if (workspace) process.stderr.write(`Retained disposable migration workspace: ${workspace}\n`);
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try { process.stdout.write(`${JSON.stringify(await rehearseMigrationUpgrade(), null, 2)}\n`); }
  catch (error) {
    // Do not print connection strings, driver diagnostics, row data, or child-process environments.
    const safeCode = /^upgrade_[a-z0-9_]+/.exec(error.message ?? "")?.[0];
    process.stderr.write(`${safeCode ?? "upgrade_verification_failed"}\n`);
    process.exitCode = 1;
  }
}
