import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { PIN_PATH, SCENARIO_PATH, SPEC_PATHS, verifyConformanceSource } from "./source-pin.mjs";

const fixtureParent = await mkdtemp(join(tmpdir(), "standing-source-pin-tests-"));
// Fixtures contain synthetic markers, not a second copy of the normative corpus.
// They are deliberately retained. No existing repository or Git index is touched.
function git(root, args, input) {
  assert.ok(root.startsWith(`${fixtureParent}/`), "Git fixture operations must remain in the task-owned temporary tree");
  return execFileSync("git", ["-C", root, ...args], {
    input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"],
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_"))),
      GIT_AUTHOR_NAME: "Source Pin Fixture", GIT_AUTHOR_EMAIL: "fixture@example.invalid",
      GIT_COMMITTER_NAME: "Source Pin Fixture", GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      GIT_AUTHOR_DATE: "2026-09-03T00:00:00Z", GIT_COMMITTER_DATE: "2026-09-03T00:00:00Z",
    },
  }).trim();
}

async function put(root, path, content) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), content);
}

async function fixture({ missingCommittedScenario = false, noPin = false, missingWorkingPath } = {}) {
  const directory = await mkdtemp(join(fixtureParent, "case-"));
  const coreRoot = join(directory, "core");
  const receiverRoot = join(directory, "receiver");
  await Promise.all([mkdir(coreRoot), mkdir(receiverRoot)]);
  git(coreRoot, ["init", "--quiet"]);
  const contents = new Map([
    [SCENARIO_PATH, 'throw new Error("The source verifier must never import fixture code");\n'],
    ["reentry-core/src/nested/fixture.mjs", "export const fixtureOnly = true;\n"],
    ["reentry-core/package.json", '{"type":"module","private":true}\n'],
    ...SPEC_PATHS.map(path => [path, `Synthetic identity fixture: ${path}\n`]),
  ]);
  for (const [path, content] of contents) {
    if (path !== missingWorkingPath) await put(coreRoot, path, content);
  }
  const tree = new Map();
  for (const [path, content] of contents) {
    if (missingCommittedScenario && path === SCENARIO_PATH) continue;
    const components = path.split("/");
    const filename = components.pop();
    let node = tree;
    for (const component of components) {
      if (!node.has(component)) node.set(component, new Map());
      node = node.get(component);
    }
    node.set(filename, git(coreRoot, ["hash-object", "-w", "--stdin"], content));
  }
  function writeTree(node) {
    const records = [...node.entries()].map(([name, entry]) => entry instanceof Map
      ? `040000 tree ${writeTree(entry)}\t${name}\0`
      : `100644 blob ${entry}\t${name}\0`);
    return git(coreRoot, ["mktree", "-z"], records.join(""));
  }
  // Plumbing writes objects and a ref only inside this newly created fixture.
  // It does not stage files or use a real contributor's index/commit workflow.
  const commit = git(coreRoot, ["commit-tree", writeTree(tree)], "Synthetic source identity fixture\n");
  git(coreRoot, ["update-ref", "HEAD", commit]);
  const pin = { schema_version: 1, profile: "standing-authorization-v0.2", core_commit: commit };
  if (!noPin) await put(receiverRoot, PIN_PATH, JSON.stringify(pin, null, 2));
  return { coreRoot, receiverRoot, commit, pin };
}

async function rejects(f, code) {
  await assert.rejects(f, error => error.code === code);
}

test("default pinned mode refuses a missing fixed-location pin", async () => {
  const f = await fixture({ noPin: true });
  await rejects(() => verifyConformanceSource(f), "conformance_pin_missing");
  await put(f.receiverRoot, "elsewhere.json", JSON.stringify(f.pin));
  await rejects(() => verifyConformanceSource({ ...f, pinPath: "elsewhere.json" }), "conformance_pin_missing");
});

test("pin schema rejects malformed, unknown, oversized, duplicate, and floating identities", async () => {
  const f = await fixture();
  for (const content of [
    "{", "[]", "null", JSON.stringify({ ...f.pin, unknown: true }),
    JSON.stringify({ ...f.pin, schema_version: 2 }),
    JSON.stringify({ ...f.pin, profile: "standing-authorization-v0.1" }),
    JSON.stringify({ ...f.pin, core_commit: "main" }),
    JSON.stringify({ ...f.pin, core_commit: "v0.2" }),
    JSON.stringify({ ...f.pin, core_commit: f.commit.slice(0, 7) }),
    `{"schema_version":1,"profile":"standing-authorization-v0.2","core_commit":"${f.commit}","core_commit":"${f.commit}"}`,
    " ".repeat(4097),
  ]) {
    await put(f.receiverRoot, PIN_PATH, content);
    await rejects(() => verifyConformanceSource(f), "conformance_pin_invalid");
  }
});

test("a real current commit is not a pin for an uncommitted standing scenario", async () => {
  const f = await fixture({ missingCommittedScenario: true });
  assert.equal(git(f.coreRoot, ["rev-parse", "HEAD"]), f.commit);
  await rejects(() => verifyConformanceSource(f), "conformance_source_not_in_commit");
});

test("an unavailable full commit is rejected rather than replaced with HEAD", async () => {
  const f = await fixture();
  await put(f.receiverRoot, PIN_PATH, JSON.stringify({ ...f.pin, core_commit: "0".repeat(40) }));
  await rejects(() => verifyConformanceSource(f), "conformance_pin_commit_unavailable");
});

test("a checkout at another commit cannot satisfy the pin", async () => {
  const f = await fixture();
  const tree = git(f.coreRoot, ["rev-parse", "HEAD^{tree}"]);
  const next = git(f.coreRoot, ["commit-tree", tree, "-p", f.commit], "Another synthetic commit\n");
  git(f.coreRoot, ["update-ref", "HEAD", next]);
  await rejects(() => verifyConformanceSource(f), "conformance_source_commit_mismatch");
});

test("modified nested Core bytes are rejected even when HEAD matches", async () => {
  const f = await fixture();
  await put(f.coreRoot, "reentry-core/src/nested/fixture.mjs", "export const changed = true;\n");
  await rejects(() => verifyConformanceSource(f), "conformance_source_bytes_mismatch");
});

test("new Core source files cannot silently enter the loaded inventory", async () => {
  const f = await fixture();
  await put(f.coreRoot, "reentry-core/src/new.mjs", "export const uncommitted = true;\n");
  await rejects(() => verifyConformanceSource(f), "conformance_source_inventory_mismatch");
});

test("committed files missing from the working source are rejected without fixture deletion", async () => {
  const f = await fixture({ missingWorkingPath: "reentry-core/src/nested/fixture.mjs" });
  await rejects(() => verifyConformanceSource(f), "conformance_source_inventory_mismatch");
  const other = await fixture({ missingWorkingPath: SPEC_PATHS[0] });
  await rejects(() => verifyConformanceSource(other), "conformance_source_missing");
});

test("local Git replacement objects cannot redefine the tree behind a pinned commit", async () => {
  const f = await fixture();
  const content = "export const replacementOnly = true;\n";
  const blob = git(f.coreRoot, ["hash-object", "-w", "--stdin"], content);
  const coreEntries = git(f.coreRoot, ["ls-tree", "-z", `${f.commit}:reentry-core`]);
  const coreTree = git(f.coreRoot, ["mktree", "-z"], `${coreEntries}100644 blob ${blob}\tinjected.mjs\0`);
  const rootEntries = git(f.coreRoot, ["ls-tree", "-z", f.commit]).split("\0").filter(Boolean)
    .map(entry => entry.endsWith("\treentry-core") ? `040000 tree ${coreTree}\treentry-core` : entry);
  const rootTree = git(f.coreRoot, ["mktree", "-z"], `${rootEntries.join("\0")}\0`);
  const replacement = git(f.coreRoot, ["commit-tree", rootTree], "Synthetic replacement attack fixture\n");
  git(f.coreRoot, ["replace", f.commit, replacement]);
  await put(f.coreRoot, "reentry-core/injected.mjs", content);
  assert.match(git(f.coreRoot, ["ls-tree", "-r", f.commit]), /injected\.mjs/,
    "The replacement must affect ordinary Git reads before testing the fenced verifier");
  await rejects(() => verifyConformanceSource(f), "conformance_source_inventory_mismatch");
});

test("governing spec bytes are part of the committed identity", async () => {
  const f = await fixture();
  await put(f.coreRoot, SPEC_PATHS[0], "Uncommitted synthetic spec change\n");
  await rejects(() => verifyConformanceSource(f), "conformance_source_bytes_mismatch");
});

test("source and fixed pin symlinks are rejected", async () => {
  const f = await fixture();
  await symlink(join(f.coreRoot, SCENARIO_PATH), join(f.coreRoot, "reentry-core/src/linked.mjs"));
  await rejects(() => verifyConformanceSource(f), "conformance_source_symlink_forbidden");
  const other = await fixture({ noPin: true });
  await put(other.receiverRoot, "elsewhere.json", JSON.stringify(other.pin));
  await mkdir(dirname(join(other.receiverRoot, PIN_PATH)), { recursive: true });
  await symlink(join(other.receiverRoot, "elsewhere.json"), join(other.receiverRoot, PIN_PATH));
  await rejects(() => verifyConformanceSource(other), "conformance_source_symlink_forbidden");
});

test("a fully committed fixture verifies identity without importing source or claiming release", async () => {
  const f = await fixture();
  // Unrelated collaborator documents are outside this source contract.
  await put(f.coreRoot, "Docs/Tasks/unrelated-owner-work.md", "Retained outside source scope\n");
  const source = await verifyConformanceSource(f);
  assert.equal(source.identity.core_commit, f.commit);
  assert.equal(source.identity.mode, "pinned");
  assert.equal(source.identity.evidence, "source_identity_verified");
  assert.equal(source.identity.source_identity_verified, true);
  assert.equal(source.identity.release_conformance_verified, false);
  assert.match(source.identity.core_source_sha256, /^[a-f0-9]{64}$/);
  await source.verifyUnchanged();
});

test("the post-run check rejects committed-source or pin mutation", async () => {
  const f = await fixture();
  const source = await verifyConformanceSource(f);
  await put(f.coreRoot, SCENARIO_PATH, "export const changedDuringRun = true;\n");
  await rejects(() => source.verifyUnchanged(), "conformance_source_bytes_mismatch");
  const other = await fixture();
  const otherSource = await verifyConformanceSource(other);
  await put(other.receiverRoot, PIN_PATH, JSON.stringify({ ...other.pin, core_commit: "main" }));
  await rejects(() => otherSource.verifyUnchanged(), "conformance_pin_invalid");
});

test("development must be explicit, remains non-release, and detects post-run drift", async () => {
  const f = await fixture({ missingCommittedScenario: true, noPin: true });
  await rejects(() => verifyConformanceSource(f), "conformance_pin_missing");
  await rejects(() => verifyConformanceSource({ ...f, mode: "release" }), "conformance_mode_invalid");
  const source = await verifyConformanceSource({ ...f, mode: "development" });
  assert.equal(source.identity.evidence, "development_working_checkout_not_release_evidence");
  assert.equal(source.identity.source_identity_verified, false);
  assert.equal(source.identity.release_conformance_verified, false);
  await source.verifyUnchanged();
  await put(f.coreRoot, SCENARIO_PATH, "export const changedDevelopmentSource = true;\n");
  await rejects(() => source.verifyUnchanged(), "conformance_source_changed");
});

test("receiver entry point enforces pinned mode before database configuration or imports", async () => {
  const f = await fixture({ noPin: true });
  // Snapshot only the current SaaS wrapper and verifier into the fixture layout.
  // No normative code is copied, and a future real accepted pin cannot affect this test.
  const directory = dirname(PIN_PATH);
  for (const name of ["receiver.test.mjs", "source-pin.mjs"]) {
    await put(f.receiverRoot, `${directory}/${name}`, await readFile(new URL(`./${name}`, import.meta.url)));
  }
  const script = join(f.receiverRoot, directory, "receiver.test.mjs");
  const env = { ...process.env, REENTRY_CONFORMANCE_ROOT: f.coreRoot, NODE_ENV: "test" };
  delete env.REENTRY_CONFORMANCE_MODE;
  delete env.STANDING_MIGRATION_TEST_DATABASE_URL;
  // A standalone child test runner must not inherit its parent's IPC test context.
  delete env.NODE_TEST_CONTEXT;
  let failure;
  try {
    execFileSync(process.execPath, ["--test", script], { env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) { failure = error; }
  assert.ok(failure, "The Receiver entry point must refuse an absent pin");
  assert.match(String(failure.stdout), /conformance_pin_missing/);
  assert.doesNotMatch(String(failure.stdout), /standing_conformance_database_url_required|must never import fixture code/);
});

test("fixture repositories remain available for inspection", async (t) => {
  assert.ok(await readFile(new URL("./source-pin.mjs", import.meta.url)));
  t.diagnostic(`Retained synthetic source-pin fixture root: ${fixtureParent}`);
});
