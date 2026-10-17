# Contributing

## Setup and checks

Use Node.js 22+, Python 3.10+, and Firefox 140+ on desktop.

```sh
git clone https://github.com/wenekar/p8zh-redirector.git
cd p8zh-redirector
npm ci
npm run check
npm run build
```

`npm run test:unit` tests URL extraction and the Firefox request handler using
Node's built-in test runner. `npm run test:build` checks archive contents,
version consistency, and reproducibility using Python's standard library.
`npm run lint:extension` runs Mozilla's extension validator. No live product
page is contacted by these tests.

Run `npm start` to launch Firefox with the extension using `web-ext`, or load
`extension/manifest.json` through `about:debugging` as described in the README.

## Project structure

| Path | Purpose |
| --- | --- |
| `extension/redirect.js` | Pure URL parsing and nested-wrapper handling. |
| `extension/background.js` | Synchronous registration of the Firefox request listener. |
| `extension/manifest.json` | Extension metadata, permissions, and compatibility. |
| `tests/` | JavaScript tests, packaging tests, and synthetic URL fixtures. |
| `scripts/package.py` | Versioned, reproducible XPI and source ZIP generation. |
| `downloads/` | Historical release binaries; excluded from new source bundles. |

Keep URL extraction independent of Firefox APIs. When changing redirect behavior,
cover the affected URL case and preserve destination encoding. Use synthetic
examples with personal tracking values removed.

## Manual Firefox checks

After changes to the manifest or background handler, verify:

1. Pasting a p8zh URL with an encoded HTTPS `adjust_redirect` opens its destination.
2. Clicking the same URL from another website and opening it in a new tab work.
3. Destination query parameters, percent escapes, and fragments survive.
4. Missing destinations and `ty://` app destinations keep normal navigation.
5. Embedded frames do not redirect the enclosing tab.

Enable the extension's private-window permission before checking private windows.
Use a controlled destination for browser tests instead of a live shopping page.

## Builds and releases

Build without installing npm dependencies using `python3 scripts/package.py`.
The script reads the version from the manifest and requires it to match
`package.json`. It writes:

```text
dist/p8zh-direct-<version>.xpi
dist/p8zh-direct-<version>-source.zip
```

The XPI contains the extension files and the MIT license. The source ZIP contains
the documented project inputs; Git metadata, dependencies, caches, previous
release downloads, and build outputs are excluded. ZIP timestamps, file modes,
and ordering are fixed so repeated builds with the same inputs and compression
toolchain produce the same bytes.

For a release, update both versions and the changelog, refresh the lockfile with
`npm install --package-lock-only`, and run the checks and build. Commit the
release changes, then create a version tag and a GitHub release pointing to that
commit. Link or attach the unsigned XPI and source ZIP, and state the temporary
installation requirement. Keep published version tags and artifacts unchanged.

Publishing on Mozilla Add-ons is a separate step covered in
[docs/amo.md](docs/amo.md).
