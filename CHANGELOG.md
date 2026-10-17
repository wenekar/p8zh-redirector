# Changelog

## Unreleased

- Separate URL extraction from Firefox event registration using native modules.
- Replace the share-link fixture with synthetic product and tracking values.
- Replace the Python packager with a validated JavaScript build using a source file
  catalog, consistent runtime/source inputs, and staged artifact writes.
- Reject missing files, escaping paths, symlinks, invalid release versions, and
  inconsistent package, manifest, and lockfile versions.
- Enforce formatting, ESLint, strict JavaScript type checking, and URL-parser coverage.
- Exercise the packaged extension with Selenium on Firefox 140 and the current release;
  run source and archive checks on Linux and Windows.
- Add continuous checks, contributor instructions, and an AMO submission guide.
- Rewrite installation instructions and publish a standalone privacy policy.

## 1.0.0 — 2026-10-17

- Automatically open website destinations embedded in `p8zh.adj.st` share links.
- Preserve destination URL encoding, query parameters, and fragments.
- Handle up to five nested wrappers with narrowly scoped Firefox permissions.
- Publish an unsigned XPI for temporary installation.
