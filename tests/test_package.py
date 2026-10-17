"""Verify release contents, versioning, and reproducible ZIP output."""

import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from zipfile import ZipFile

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/package.py"
SPEC = importlib.util.spec_from_file_location("package_script", SCRIPT)
PACKAGE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(PACKAGE)


class PackageTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        files = {
            "package.json": json.dumps({"version": "2.3.4"}),
            "extension/manifest.json": json.dumps({"version": "2.3.4"}),
            "extension/background.js": 'import "./redirect.js";\n',
            "extension/redirect.js": "export const host = 'p8zh.adj.st';\n",
            "LICENSE": "MIT License\n",
            "README.md": "# Test project\n",
            "tests/fixtures/share-url.txt": "https://p8zh.adj.st/example\n",
            "scripts/__pycache__/package.pyc": "cached bytecode",
            "downloads/old-release.xpi": "previous release",
            "dist/previous-build.zip": "build output",
            "node_modules/dependency/index.js": "development dependency",
            ".git/config": "local git config",
            "local-only.txt": "not a source input",
        }
        for name, content in files.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(content, encoding="utf-8")

    def test_versioned_archives_contain_only_distribution_inputs(self):
        xpi, source = PACKAGE.build_archives(self.root)
        self.assertEqual(xpi.name, "p8zh-direct-2.3.4.xpi")
        self.assertEqual(source.name, "p8zh-direct-2.3.4-source.zip")
        with ZipFile(xpi) as archive:
            self.assertIsNone(archive.testzip())
            self.assertEqual(set(archive.namelist()), {
                "manifest.json", "background.js", "redirect.js", "LICENSE",
            })
        with ZipFile(source) as archive:
            self.assertIsNone(archive.testzip())
            names = set(archive.namelist())
            self.assertIn("p8zh-direct-2.3.4/tests/fixtures/share-url.txt", names)
            self.assertEqual(len(names), 7)

    def test_identical_inputs_produce_identical_bytes_despite_metadata(self):
        first = PACKAGE.build_archives(self.root, self.root / "first")
        expected = [path.read_bytes() for path in first]
        for path in (self.root / "extension").iterdir():
            os.utime(path, (1_700_000_000, 1_700_000_000))
            path.chmod(0o600)
        second = PACKAGE.build_archives(self.root, self.root / "second")
        self.assertEqual(expected, [path.read_bytes() for path in second])

    def test_mismatched_versions_fail_before_writing_artifacts(self):
        (self.root / "package.json").write_text('{"version": "2.3.5"}')
        output = self.root / "rejected"
        with self.assertRaisesRegex(ValueError, "versions differ"):
            PACKAGE.build_archives(self.root, output)
        self.assertFalse(output.exists())

    def test_source_archive_can_rebuild_the_same_extension(self):
        xpi, source = PACKAGE.build_archives(self.root)
        with ZipFile(source) as archive:
            archive.extractall(self.root / "extracted")
        extracted = self.root / "extracted/p8zh-direct-2.3.4"
        rebuilt, _ = PACKAGE.build_archives(extracted)
        self.assertEqual(xpi.read_bytes(), rebuilt.read_bytes())
