"use strict";
// Test-only authority: a private provisioner receipt plus live cluster identity.
// A loopback address or familiar database name alone is never sufficient.
const { lstatSync, readFileSync } = require("node:fs");
const { isAbsolute, dirname, resolve } = require("node:path");
const DATABASE_ALIASES = Object.freeze([
  "DATABASE_URL", "DIRECT_URL", "CLOUD_RECEIVER_RUNTIME_DATABASE_URL",
  "STANDING_MIGRATION_TEST_DATABASE_URL", "STANDING_RACE_TEST_DATABASE_URL",
  "STANDING_CONSENT_CONCURRENCY_TEST_DATABASE_URL",
]);
function fail(code) { throw Object.assign(new Error(code), { code }); }
function regularOwnedPath(path, directory = false) {
  if (typeof path !== "string" || !isAbsolute(path) || resolve(path) !== path) throw new Error();
  for (let current = path; ; current = dirname(current)) {
    if (lstatSync(current).isSymbolicLink()) throw new Error();
    if (current === dirname(current)) break;
  }
  const stat = lstatSync(path);
  if (!(directory ? stat.isDirectory() : stat.isFile()) || (stat.mode & 0o077) !== 0 ||
      typeof process.getuid !== "function" || stat.uid !== process.getuid()) throw new Error();
  return stat;
}
function readProof(path) {
  try {
    if (regularOwnedPath(path).size > 4096) throw new Error();
    const proof = JSON.parse(readFileSync(path, "utf8"));
    if (!proof || Object.keys(proof).sort().join(",") !==
      "data_directory,database,port,system_identifier,user,version" || proof.version !== 1 ||
      !/^cr_test_[a-f0-9]{32}$/.test(proof.database) || proof.user !== "cr_test" ||
      !Number.isInteger(proof.port) || proof.port < 1024 || proof.port > 65535 ||
      typeof proof.system_identifier !== "string" || !/^\d{10,25}$/.test(proof.system_identifier)) throw new Error();
    regularOwnedPath(proof.data_directory, true);
    return Object.freeze(proof);
  } catch { fail("test_database_proof_invalid"); }
}
function requireOwnedDatabase(env) {
  if (env.NODE_ENV !== "test") fail("test_database_requires_test_mode");
  if (Object.entries(env).some(([key, value]) => key.startsWith("PG") && value)) {
    fail("test_database_routing_override");
  }
  const proof = readProof(env.RECEIVER_TEST_DATABASE_PROOF);
  const value = env.DATABASE_URL;
  if (typeof value !== "string" || !value || DATABASE_ALIASES.some(key => env[key] !== value)) {
    fail("test_database_alias_mismatch");
  }
  let url;
  try { url = new URL(value); } catch { fail("test_database_url_invalid"); }
  if (!["postgres:", "postgresql:"].includes(url.protocol) || url.hostname !== "127.0.0.1" ||
      url.port !== String(proof.port) || url.pathname !== `/${proof.database}` ||
      url.username !== proof.user || !url.password || url.search || url.hash) fail("test_database_url_invalid");
  return Object.freeze({ databaseUrl: value, proof });
}
function assertDatabaseIdentity(row, selected) {
  const proof = selected.proof;
  if (!row || row.database !== proof.database || row.user !== proof.user || row.address !== "127.0.0.1" ||
      row.port !== proof.port || row.data_directory !== proof.data_directory ||
      row.system_identifier !== proof.system_identifier) fail("test_database_identity_mismatch");
}
async function verifyOwnedDatabase(env) {
  const selected = requireOwnedDatabase(env);
  const { Client } = require("pg");
  const client = new Client({ connectionString: selected.databaseUrl, connectionTimeoutMillis: 3000 });
  try {
    await client.connect();
    const { rows } = await client.query(`SELECT current_database() AS database, current_user AS "user",
      host(inet_server_addr()) AS address, inet_server_port() AS port,
      current_setting('data_directory') AS data_directory,
      (SELECT system_identifier::text FROM pg_control_system()) AS system_identifier`);
    assertDatabaseIdentity(rows[0], selected);
    return selected;
  } catch (error) {
    if (error.code === "test_database_identity_mismatch") throw error;
    fail("test_database_identity_unavailable");
  } finally { await client.end(); }
}
module.exports = { DATABASE_ALIASES, requireOwnedDatabase, assertDatabaseIdentity, verifyOwnedDatabase };
