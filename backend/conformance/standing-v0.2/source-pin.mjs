import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";

export const PIN_PATH = "backend/conformance/standing-v0.2/core-pin.json";
export const SCENARIO_PATH = "reentry-core/conformance/standing-v0.2/scenario.mjs";
export const SPEC_PATHS = Object.freeze([
  "Docs/Decisions/ADR-0043-adopt-standing-authorization-v0.2.md",
  "Docs/Decisions/ADR-0044-allow-conforming-receiver-implementations.md",
  "Docs/Decisions/ADR-0045-adopt-standing-transport-profile-v0.2.md",
  "Docs/Mechanisms/01-host-integration-manifest-and-enrollment.md",
  "Docs/Mechanisms/02-receiver-grant-and-event-authority.md",
  "Docs/Mechanisms/03-delivery-lease-and-local-connector.md",
]);
const PROFILE = "standing-authorization-v0.2";
const SCOPE = ["reentry-core", ...SPEC_PATHS];

function fail(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}

function git(root, args, code = "conformance_source_git_invalid") {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("GIT_")));
  env.GIT_NO_REPLACE_OBJECTS = "1";
  try {
    return execFileSync("git", ["-C", root, ...args], {
      env, stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024,
    });
  } catch {
    fail(code);
  }
}

async function regularFile(root, path, missingCode) {
  let current = root;
  const components = path.split("/");
  for (const [index, component] of components.entries()) {
    current = join(current, component);
    let stat;
    try { stat = await lstat(current); } catch { fail(missingCode); }
    if (stat.isSymbolicLink()) fail("conformance_source_symlink_forbidden");
    if (index < components.length - 1 ? !stat.isDirectory() : !stat.isFile()) {
      fail("conformance_source_file_invalid");
    }
  }
  return readFile(current);
}

async function readPin(receiverRoot) {
  let size;
  try { size = (await lstat(join(receiverRoot, PIN_PATH))).size; }
  catch { fail("conformance_pin_missing"); }
  if (size > 4096) fail("conformance_pin_invalid");
  const bytes = await regularFile(receiverRoot, PIN_PATH, "conformance_pin_missing");
  if (bytes.length > 4096) fail("conformance_pin_invalid");
  let pin;
  try { pin = JSON.parse(bytes.toString("utf8")); } catch { fail("conformance_pin_invalid"); }
  if (!pin || Array.isArray(pin) || typeof pin !== "object" ||
      Object.keys(pin).sort().join(",") !== "core_commit,profile,schema_version" ||
      pin.schema_version !== 1 || pin.profile !== PROFILE ||
      typeof pin.core_commit !== "string" || !/^[a-f0-9]{40}$/.test(pin.core_commit)) {
    fail("conformance_pin_invalid");
  }
  // Values and field names are fixed ASCII without spaces. This also rejects
  // duplicate keys and escaped spellings instead of accepting JSON's last key.
  if (bytes.toString("utf8").replace(/\s/g, "") !== JSON.stringify(pin)) {
    fail("conformance_pin_invalid");
  }
  return pin;
}

async function inventory(root) {
  const files = [];
  async function visit(path) {
    const absolute = join(root, path);
    let stat;
    try { stat = await lstat(absolute); } catch { fail("conformance_source_missing"); }
    if (stat.isSymbolicLink()) fail("conformance_source_symlink_forbidden");
    if (stat.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) await visit(`${path}/${name}`);
    } else if (stat.isFile()) {
      files.push(path);
    } else {
      fail("conformance_source_file_invalid");
    }
  }
  await visit("reentry-core");
  for (const path of SPEC_PATHS) {
    await regularFile(root, path, "conformance_source_missing");
    files.push(path);
  }
  if (!files.includes(SCENARIO_PATH)) fail("shared_standing_scenario_missing");
  return files.sort();
}

function committedInventory(root, commit) {
  if (git(root, ["cat-file", "-t", commit], "conformance_pin_commit_unavailable").toString().trim() !== "commit") {
    fail("conformance_pin_commit_invalid");
  }
  const records = git(root, ["ls-tree", "-r", "-z", "--full-tree", commit, "--", ...SCOPE])
    .toString("utf8").split("\0").filter(Boolean).map(record => {
      const match = /^(100644|100755) blob ([a-f0-9]{40})\t(.+)$/.exec(record);
      if (!match) fail("conformance_committed_source_type_invalid");
      return { path: match[3], blob: match[2] };
    });
  for (const path of [SCENARIO_PATH, ...SPEC_PATHS]) {
    if (!records.some(record => record.path === path)) fail("conformance_source_not_in_commit");
  }
  return records.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
}

/** Source identity only: never a conformance, migration, or release verdict. */
export async function verifyConformanceSource({ coreRoot, receiverRoot, mode = "pinned" }) {
  if (!["pinned", "development"].includes(mode)) fail("conformance_mode_invalid");
  if (!isAbsolute(coreRoot ?? "") || !isAbsolute(receiverRoot ?? "")) fail("conformance_root_invalid");
  let core;
  let receiver;
  try { [core, receiver] = await Promise.all([realpath(coreRoot), realpath(receiverRoot)]); }
  catch { fail("conformance_root_invalid"); }
  if (git(core, ["rev-parse", "--show-toplevel"]).toString().trim() !== core) {
    fail("reentry_conformance_root_not_repository_root");
  }

  async function verify() {
    const pin = mode === "pinned" ? await readPin(receiver) : null;
    const commit = git(core, ["rev-parse", "HEAD"]).toString().trim();
    const committed = pin ? committedInventory(core, pin.core_commit) : null;
    if (pin && commit !== pin.core_commit) fail("conformance_source_commit_mismatch");
    const paths = await inventory(core);
    if (committed && JSON.stringify(paths) !== JSON.stringify(committed.map(record => record.path))) {
      fail("conformance_source_inventory_mismatch");
    }
    const hash = createHash("sha256");
    for (const [index, path] of paths.entries()) {
      const bytes = await regularFile(core, path, "conformance_source_missing");
      if (committed && !bytes.equals(git(core, ["cat-file", "blob", committed[index].blob]))) {
        fail("conformance_source_bytes_mismatch");
      }
      hash.update(path).update("\0").update(bytes).update("\0");
    }
    return Object.freeze({
      mode, profile: PROFILE, core_commit: commit, core_source_sha256: hash.digest("hex"),
      evidence: pin ? "source_identity_verified" : "development_working_checkout_not_release_evidence",
      source_identity_verified: Boolean(pin), release_conformance_verified: false,
    });
  }

  const identity = await verify();
  return Object.freeze({
    identity,
    async verifyUnchanged() {
      const current = await verify();
      try { assert.deepEqual(current, identity); } catch { fail("conformance_source_changed"); }
    },
  });
}
