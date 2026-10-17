import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  unlink,
  utimes,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { strFromU8, unzipSync } from "fflate";
import { buildProject } from "../scripts/lib/build.js";

/** @param {string} root @param {string} name @param {unknown} value */
async function writeJson(root, name, value) {
  await writeFile(join(root, name), JSON.stringify(value));
}

/** @param {import("node:test").TestContext} t */
async function fixture(t) {
  const root = await realpath(await mkdtemp(join(tmpdir(), "p8zh-build-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const pkg = {
    version: "2.3.4",
    files: [
      "extension",
      "LICENSE",
      "package.json",
      "package-lock.json",
      "scripts",
      "README.md",
    ],
  };
  const manifest = {
    version: "2.3.4",
    background: { scripts: ["background.js"], type: "module" },
  };
  const lock = { version: "2.3.4", packages: { "": { version: "2.3.4" } } };
  const files = {
    "package.json": JSON.stringify(pkg),
    "package-lock.json": JSON.stringify(lock),
    "extension/manifest.json": JSON.stringify(manifest),
    "extension/background.js": 'import "./redirect.js";\n',
    "extension/redirect.js": "export const host = 'p8zh.adj.st';\n",
    "extension/.DS_Store": "platform metadata",
    LICENSE: "MIT License\n",
    "README.md": "# Test project\n",
    "scripts/build.js": "// Build source belongs in the source archive.\n",
    "scripts/__pycache__/old.pyc": "old cache",
    "downloads/previous.xpi": "previous release",
    "node_modules/local-package/index.js": "local dependency",
    "dist/previous.zip": "previous output",
    ".git/config": "local Git metadata",
    "unlisted.txt": "not a source input",
  };
  for (const [name, contents] of Object.entries(files)) {
    await mkdir(dirname(join(root, name)), { recursive: true });
    await writeFile(join(root, name), contents);
  }
  return { root, pkg, manifest, lock };
}

/** @param {Uint8Array} bytes @param {string} name */
function readEntry(bytes, name) {
  const value = unzipSync(bytes)[name];
  assert.ok(value, `archive must contain ${name}`);
  return value;
}

test("builds versioned archives containing the runtime and rebuild inputs", async (t) => {
  const { root } = await fixture(t);
  const { xpi, source } = await buildProject(root);
  assert.equal(xpi, join(root, "dist/p8zh-direct-2.3.4.xpi"));
  assert.equal(source, join(root, "dist/p8zh-direct-2.3.4-source.zip"));
  const runtime = unzipSync(await readFile(xpi));
  assert.deepEqual(Object.keys(runtime).sort(), [
    "LICENSE",
    "background.js",
    "manifest.json",
    "redirect.js",
  ]);
  assert.equal(strFromU8(readEntry(await readFile(xpi), "LICENSE")), "MIT License\n");
  const sources = unzipSync(await readFile(source));
  assert.ok(sources["p8zh-direct-2.3.4/scripts/build.js"]);
  assert.ok(sources["p8zh-direct-2.3.4/package-lock.json"]);
  for (const name of Object.keys(sources)) {
    assert.doesNotMatch(
      name,
      /(?:__pycache__|downloads|node_modules|\/dist\/|\.git\/|\.DS_Store|unlisted\.txt)/,
    );
  }
  assert.deepEqual((await readdir(join(root, "dist"))).sort(), [
    "p8zh-direct-2.3.4-source.zip",
    "p8zh-direct-2.3.4.xpi",
    "previous.zip",
  ]);
});

test("source and XPI contain the same runtime bytes", async (t) => {
  const { root } = await fixture(t);
  const { xpi: xpiPath, source: sourcePath } = await buildProject(root);
  const xpi = unzipSync(await readFile(xpiPath));
  const source = await readFile(sourcePath);
  for (const [name, bytes] of Object.entries(xpi)) {
    const entry = name === "LICENSE" ? name : `extension/${name}`;
    assert.deepEqual(readEntry(source, `p8zh-direct-2.3.4/${entry}`), bytes);
  }
});

test("builds are byte-identical after input file metadata changes", async (t) => {
  const { root } = await fixture(t);
  const paths = Object.values(await buildProject(root));
  const first = await Promise.all(paths.map((path) => readFile(path)));
  await utimes(join(root, "extension/background.js"), 1_700_000_000, 1_700_000_000);
  const pkgBytes = await readFile(join(root, "package.json"));
  await unlink(join(root, "package.json"));
  await writeFile(join(root, "package.json"), pkgBytes);
  await buildProject(root);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), first);
});

test("source archive can rebuild the identical extension", async (t) => {
  const { root } = await fixture(t);
  const { xpi, source } = await buildProject(root);
  const extracted = join(root, "extracted");
  for (const [name, bytes] of Object.entries(unzipSync(await readFile(source)))) {
    const path = join(extracted, name);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, bytes);
  }
  const { xpi: rebuilt } = await buildProject(join(extracted, "p8zh-direct-2.3.4"));
  assert.deepEqual(await readFile(rebuilt), await readFile(xpi));
});

for (const version of [
  null,
  1,
  "../outside",
  "1.2",
  "01.2.3",
  "65536.0.0",
  "1.2.3-beta",
]) {
  test(`rejects invalid release version ${JSON.stringify(version)}`, async (t) => {
    const { root, pkg } = await fixture(t);
    await writeJson(root, "package.json", { ...pkg, version });
    await assert.rejects(buildProject(root), /major\.minor\.patch/);
  });
}

for (const target of ["manifest", "lock", "lock root"]) {
  test(`rejects a version mismatch in ${target}`, async (t) => {
    const { root, manifest, lock } = await fixture(t);
    if (target === "manifest") {
      await writeJson(root, "extension/manifest.json", {
        ...manifest,
        version: "2.3.5",
      });
    } else if (target === "lock") {
      await writeJson(root, "package-lock.json", { ...lock, version: "2.3.5" });
    } else {
      await writeJson(root, "package-lock.json", {
        ...lock,
        packages: { "": { version: "2.3.5" } },
      });
    }
    await assert.rejects(buildProject(root), /Versions must match/);
  });
}

for (const files of [null, [], [1], [""]]) {
  test(`rejects malformed source catalog ${JSON.stringify(files)}`, async (t) => {
    const { root, pkg } = await fixture(t);
    await writeJson(root, "package.json", { ...pkg, files });
    await assert.rejects(buildProject(root), /files must list/);
  });
}

test("requires the source catalog to include rebuild metadata", async (t) => {
  const { root, pkg } = await fixture(t);
  await writeJson(root, "package.json", { ...pkg, files: ["extension"] });
  await assert.rejects(buildProject(root), /files must include/);
});

for (const entry of [".", "..", "../outside.txt"]) {
  test(`rejects source entry outside the catalog boundary: ${entry}`, async (t) => {
    const { root, pkg } = await fixture(t);
    await writeJson(root, "package.json", { ...pkg, files: [...pkg.files, entry] });
    await assert.rejects(buildProject(root), /must stay within the project/);
  });
}

test("fails rather than silently omitting a missing listed source file", async (t) => {
  const { root } = await fixture(t);
  await unlink(join(root, "README.md"));
  await assert.rejects(buildProject(root), { code: "ENOENT" });
});

test("rejects directory symlinks and explicitly listed descendants", async (t) => {
  const { root, pkg } = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), "p8zh-outside-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await writeFile(join(outside, "external.txt"), "not project source");
  await symlink(outside, join(root, "linked"), "junction");
  for (const entry of ["linked", "linked/external.txt"]) {
    await writeJson(root, "package.json", { ...pkg, files: [...pkg.files, entry] });
    await assert.rejects(buildProject(root), /Symbolic links are not supported/);
  }
});

test("a validation failure preserves both existing artifacts and leaves no staging files", async (t) => {
  const { root, manifest } = await fixture(t);
  const paths = Object.values(await buildProject(root));
  const before = await Promise.all(paths.map((path) => readFile(path)));
  await writeJson(root, "extension/manifest.json", {
    ...manifest,
    background: { scripts: ["missing.js"] },
  });
  await assert.rejects(buildProject(root), /background script must exist/);
  assert.deepEqual(await Promise.all(paths.map((path) => readFile(path))), before);
  assert.ok(
    (await readdir(join(root, "dist"))).every((name) => !name.startsWith(".build-")),
  );
});

test("reports malformed JSON with its filename", async (t) => {
  const { root } = await fixture(t);
  await writeFile(join(root, "extension/manifest.json"), "{");
  await assert.rejects(buildProject(root), /Invalid JSON in extension\/manifest.json/);
});

test("rejects non-object metadata", async (t) => {
  const { root } = await fixture(t);
  await writeJson(root, "package-lock.json", []);
  await assert.rejects(buildProject(root), /package-lock.json must be a JSON object/);
});

test("rejects an explicitly listed dependency directory", async (t) => {
  const { root, pkg } = await fixture(t);
  await writeJson(root, "package.json", {
    ...pkg,
    files: [...pkg.files, "node_modules"],
  });
  await assert.rejects(buildProject(root), /excluded from distributions/);
});

test("requires the extension manifest in the archive inputs", async (t) => {
  const { root } = await fixture(t);
  await unlink(join(root, "extension/manifest.json"));
  await assert.rejects(
    buildProject(root),
    /Required build input is missing: extension\/manifest.json/,
  );
});

test("does not publish artifacts through a symlinked output directory", async (t) => {
  const { root } = await fixture(t);
  const outside = await mkdtemp(join(tmpdir(), "p8zh-output-"));
  t.after(() => rm(outside, { recursive: true, force: true }));
  await rm(join(root, "dist"), { recursive: true });
  await symlink(outside, join(root, "dist"), "junction");
  await assert.rejects(
    buildProject(root),
    /Output directory must not be a symbolic link/,
  );
  assert.deepEqual(await readdir(outside), []);
});
