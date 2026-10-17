import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { zipSync } from "fflate";

const REQUIRED_SOURCE_ENTRIES = [
  "extension",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "scripts",
];
const IGNORED_NAMES = new Set([
  ".git",
  ".DS_Store",
  "node_modules",
  "dist",
  "coverage",
  "__pycache__",
]);
const VERSION_PATTERN = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/;

/**
 * @param {unknown} value
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function object(value, label) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return /** @type {Record<string, unknown>} */ (value);
}

/**
 * @param {Uint8Array} bytes
 * @param {string} label
 * @returns {Record<string, unknown>}
 */
function parseJson(bytes, label) {
  let value;
  try {
    value = JSON.parse(Buffer.from(bytes).toString("utf8"));
  } catch (cause) {
    throw new Error(`Invalid JSON in ${label}`, { cause });
  }
  return object(value, label);
}

/** @param {string} root @param {string} entry */
function projectPath(root, entry) {
  const path = resolve(root, entry);
  const local = relative(root, path);
  if (
    local === "" ||
    local === ".." ||
    local.startsWith(`..${sep}`) ||
    isAbsolute(local)
  ) {
    throw new Error(`Source entry must stay within the project: ${entry}`);
  }
  if (local.split(sep).some((part) => IGNORED_NAMES.has(part))) {
    throw new Error(`Source entry is excluded from distributions: ${entry}`);
  }
  return path;
}

/**
 * @param {string} root
 * @param {string[]} entries
 * @returns {Promise<Map<string, Uint8Array>>}
 */
async function collectFiles(root, entries) {
  /** @type {Map<string, Uint8Array>} */
  const files = new Map();

  /** @param {string} path @returns {Promise<void>} */
  async function visit(path) {
    const info = await lstat(path);
    const name = relative(root, path).split(sep).join("/");
    // realpath also catches a symlink in an explicitly listed entry's parents.
    if (info.isSymbolicLink() || (await realpath(path)) !== path) {
      throw new Error(`Symbolic links are not supported in build inputs: ${name}`);
    }
    if (info.isDirectory()) {
      for (const child of await readdir(path)) {
        if (!IGNORED_NAMES.has(child)) {
          await visit(join(path, child));
        }
      }
    } else if (info.isFile()) {
      files.set(name, await readFile(path));
    } else {
      throw new Error(`Build input is not a regular file or directory: ${name}`);
    }
  }

  for (const entry of entries) {
    await visit(projectPath(root, entry));
  }
  return files;
}

/**
 * @param {Map<string, Uint8Array>} files
 * @param {string} name
 * @returns {Uint8Array}
 */
function requiredFile(files, name) {
  const bytes = files.get(name);
  if (bytes === undefined) {
    throw new Error(`Required build input is missing: ${name}`);
  }
  return bytes;
}

/** @param {Map<string, Uint8Array>} files @param {string} [prefix] */
function archive(files, prefix = "") {
  // Lexical ordering is independent of the host's locale.
  const sorted = [...files].sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return zipSync(
    Object.fromEntries(sorted.map(([name, bytes]) => [prefix + name, bytes])),
    {
      level: 9,
      mtime: new Date(1980, 0, 1),
      os: 3,
      attrs: 0o100644 * 2 ** 16,
    },
  );
}

/**
 * Build from one input snapshot. Validate and compress both archives before any
 * output is written; move each completed artifact into place atomically.
 *
 * @param {string} directory
 * @returns {Promise<{xpi: string, source: string}>}
 */
export async function buildProject(directory) {
  const root = await realpath(directory);
  const packageBytes = await readFile(join(root, "package.json"));
  const pkg = parseJson(packageBytes, "package.json");
  const entries = pkg.files;
  if (
    !Array.isArray(entries) ||
    entries.length === 0 ||
    !entries.every((entry) => typeof entry === "string" && entry.length > 0)
  ) {
    throw new Error("package.json files must list the source files and directories");
  }
  if (!REQUIRED_SOURCE_ENTRIES.every((entry) => entries.includes(entry))) {
    throw new Error(
      `package.json files must include: ${REQUIRED_SOURCE_ENTRIES.join(", ")}`,
    );
  }

  const sourceFiles = await collectFiles(root, entries);
  if (!packageBytes.equals(requiredFile(sourceFiles, "package.json"))) {
    throw new Error("package.json changed during the build; retry with stable inputs");
  }
  const manifest = parseJson(
    requiredFile(sourceFiles, "extension/manifest.json"),
    "extension/manifest.json",
  );
  const lock = parseJson(
    requiredFile(sourceFiles, "package-lock.json"),
    "package-lock.json",
  );
  const version = pkg.version;
  if (
    typeof version !== "string" ||
    !VERSION_PATTERN.test(version) ||
    version.split(".").some((part) => Number(part) > 65535)
  ) {
    throw new Error(
      "package.json version must use major.minor.patch, with each part from 0 to 65535 and no leading zeros",
    );
  }
  const lockRoot = object(
    object(lock.packages, "package-lock.json packages")[""],
    "lockfile root package",
  );
  if (
    [manifest.version, lock.version, lockRoot.version].some(
      (value) => value !== version,
    )
  ) {
    throw new Error(
      "Versions must match in manifest.json, package.json, and package-lock.json",
    );
  }

  const extensionFiles = new Map(
    [...sourceFiles]
      .filter(([name]) => name.startsWith("extension/"))
      .map(([name, bytes]) => [name.slice("extension/".length), bytes]),
  );
  const background = object(manifest.background, "manifest background");
  if (
    !Array.isArray(background.scripts) ||
    background.scripts.length === 0 ||
    !background.scripts.every(
      (script) => typeof script === "string" && extensionFiles.has(script),
    )
  ) {
    throw new Error("Every manifest background script must exist in extension/");
  }
  extensionFiles.set("LICENSE", requiredFile(sourceFiles, "LICENSE"));
  const xpi = { name: `p8zh-direct-${version}.xpi`, bytes: archive(extensionFiles) };
  const source = {
    name: `p8zh-direct-${version}-source.zip`,
    bytes: archive(sourceFiles, `p8zh-direct-${version}/`),
  };
  const artifacts = [xpi, source];

  const output = join(root, "dist");
  await mkdir(output, { recursive: true });
  if ((await realpath(output)) !== output) {
    throw new Error("Output directory must not be a symbolic link: dist/");
  }
  const staging = await mkdtemp(join(output, ".build-"));
  try {
    await Promise.all(
      artifacts.map(({ name, bytes }) => writeFile(join(staging, name), bytes)),
    );
    for (const { name } of artifacts) {
      await rename(join(staging, name), join(output, name));
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
  return {
    xpi: join(output, xpi.name),
    source: join(output, source.name),
  };
}
