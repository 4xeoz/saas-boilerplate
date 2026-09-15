import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { realpathSync } from "node:fs";
import test from "node:test";
import { createRequire } from "node:module";
const { DATABASE_ALIASES, requireOwnedDatabase, assertDatabaseIdentity } = createRequire(import.meta.url)("./disposable-database.cjs");

function fixture() {
  const root = mkdtempSync(join(realpathSync(tmpdir()), "receiver-proof-test-"));
  const data = join(root, "data"); mkdirSync(data, { mode: 0o700 });
  const proof = { version: 1, database: `cr_test_${"a".repeat(32)}`, port: 61234,
    user: "cr_test", data_directory: data, system_identifier: "7654321098765432100" };
  const path = join(root, "proof.json");
  writeFileSync(path, JSON.stringify(proof), { mode: 0o600 });
  const url = `postgresql://cr_test:synthetic@127.0.0.1:${proof.port}/${proof.database}`;
  const env = { NODE_ENV: "test", RECEIVER_TEST_DATABASE_PROOF: path,
    ...Object.fromEntries(DATABASE_ALIASES.map(key => [key, url])) };
  return { root, proof, path, url, env };
}

test("a private proof permits an arbitrary owned loopback port with all aliases equal", () => {
  const f = fixture();
  assert.equal(requireOwnedDatabase(f.env).databaseUrl, f.url);
});

test("missing authority, alias drift, routing overrides and malformed transport fail closed", () => {
  const f = fixture();
  for (const update of [{ NODE_ENV: "production" }, { RECEIVER_TEST_DATABASE_PROOF: undefined },
    { PGHOST: "remote.example" }, ...DATABASE_ALIASES.map(key => ({ [key]: undefined }))]) {
    assert.throws(() => requireOwnedDatabase({ ...f.env, ...update }), /test_database_/);
  }
  for (const url of [f.url + "?host=remote.example", f.url + "#override", f.url.replace("127.0.0.1", "localhost"),
    f.url.replace("127.0.0.1", "remote.example"), f.url.replace("61234", "55432"),
    f.url.replace(f.proof.database, "production"), f.url.replace("postgresql:", "https:")]) {
    assert.throws(() => requireOwnedDatabase({ ...f.env, ...Object.fromEntries(DATABASE_ALIASES.map(key => [key, url])) }), /test_database_/);
  }
  assert.throws(() => requireOwnedDatabase({ ...f.env, DIRECT_URL: f.url + "x" }), /test_database_alias_mismatch/);
});

test("a proof cannot be a symlink, public file, malformed shape or another local identity", () => {
  const f = fixture();
  const link = join(f.root, "linked.json"); symlinkSync(f.path, link);
  assert.throws(() => requireOwnedDatabase({ ...f.env, RECEIVER_TEST_DATABASE_PROOF: link }), /test_database_proof_invalid/);
  chmodSync(f.path, 0o644);
  assert.throws(() => requireOwnedDatabase(f.env), /test_database_proof_invalid/);
  chmodSync(f.path, 0o600);
  for (const proof of [{ ...f.proof, extra: true }, { ...f.proof, database: "production" },
    { ...f.proof, data_directory: "relative" }, { ...f.proof, system_identifier: "unknown" }]) {
    writeFileSync(f.path, JSON.stringify(proof));
    assert.throws(() => requireOwnedDatabase(f.env), /test_database_proof_invalid/);
  }
});

test("live database identity must match cluster, directory, database, user, address and port", () => {
  const f = fixture(); const selected = requireOwnedDatabase(f.env);
  const row = { ...f.proof, address: "127.0.0.1" }; delete row.version;
  assert.doesNotThrow(() => assertDatabaseIdentity(row, selected));
  for (const [key, value] of Object.entries({ database: "another", user: "another", address: "::1",
    port: 55432, data_directory: resolve(f.root, "other"), system_identifier: "7654321098765432101" })) {
    assert.throws(() => assertDatabaseIdentity({ ...row, [key]: value }, selected), /test_database_identity_mismatch/);
  }
});
