"""Build reproducible, unsigned Firefox and source archives using Python 3."""

import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
SOURCE_PATHS = (
    ".editorconfig",
    ".gitattributes",
    ".github",
    ".gitignore",
    "CHANGELOG.md",
    "CONTRIBUTING.md",
    "LICENSE",
    "PRIVACY.md",
    "README.md",
    "docs",
    "extension",
    "package-lock.json",
    "package.json",
    "scripts",
    "tests",
)
IGNORED_NAMES = {"__pycache__", "node_modules", ".DS_Store"}


def collect_files(root, paths):
    """Collect project inputs without caches, symlinks, or generated releases."""
    files = {}
    for name in paths:
        path = root / name
        candidates = path.rglob("*") if path.is_dir() else [path]
        for file in candidates:
            relative = file.relative_to(root)
            if any(part in IGNORED_NAMES for part in relative.parts):
                continue
            if file.is_file() and not file.is_symlink() and file.suffix != ".pyc":
                files[relative.as_posix()] = file
    return files


def write_archive(destination, files, prefix=""):
    """Use fixed timestamps, permissions, and ordering for stable ZIP bytes."""
    with ZipFile(destination, "w") as archive:
        for name, file in sorted(files.items()):
            info = ZipInfo(prefix + name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            archive.writestr(
                info,
                file.read_bytes(),
                compress_type=ZIP_DEFLATED,
                compresslevel=9,
            )


def build_archives(root=ROOT, output=None):
    """Build both archives, requiring matching package and manifest versions."""
    manifest = json.loads(
        (root / "extension/manifest.json").read_text(encoding="utf-8")
    )
    package = json.loads((root / "package.json").read_text(encoding="utf-8"))
    version = manifest["version"]
    if package["version"] != version:
        raise ValueError("package.json and extension/manifest.json versions differ")

    output = output if output is not None else root / "dist"
    output.mkdir(parents=True, exist_ok=True)
    xpi = output / f"p8zh-direct-{version}.xpi"
    source = output / f"p8zh-direct-{version}-source.zip"

    extension_files = collect_files(root / "extension", ["."])
    extension_files["LICENSE"] = root / "LICENSE"
    write_archive(xpi, extension_files)
    write_archive(
        source,
        collect_files(root, SOURCE_PATHS),
        prefix=f"p8zh-direct-{version}/",
    )
    return xpi, source


if __name__ == "__main__":
    for artifact in build_archives():
        print(artifact)
