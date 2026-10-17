"""Build the unsigned add-on and a source bundle without third-party tools."""

from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
DIST.mkdir(exist_ok=True)

with ZipFile(DIST / "p8zh-direct-1.0.0.xpi", "w", ZIP_DEFLATED) as archive:
    for file in sorted((ROOT / "extension").rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(ROOT / "extension"))
    archive.write(ROOT / "LICENSE", "LICENSE")

with ZipFile(DIST / "p8zh-direct-source.zip", "w", ZIP_DEFLATED) as archive:
    for file in sorted(ROOT.rglob("*")):
        relative = file.relative_to(ROOT)
        if any(part in {"node_modules", "dist", ".git", "__pycache__"} for part in relative.parts):
            continue
        if file.is_file():
            archive.write(file, Path("p8zh-direct") / relative)

print(DIST / "p8zh-direct-1.0.0.xpi")
print(DIST / "p8zh-direct-source.zip")
