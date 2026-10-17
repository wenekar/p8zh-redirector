# Contributing

Use Node.js 22.14+ and npm. Firefox is needed only for browser tests and interactive
development. The extension runs as native JavaScript, with no runtime dependencies or
compilation step.

## Setup

```sh
git clone https://github.com/wenekar/p8zh-redirector.git
cd p8zh-redirector
npm ci
npm run check
```

## Checks

| Command                | Purpose                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `npm run check`        | Run every source check, unit test, packaging test, and Mozilla validation.           |
| `npm run format`       | Apply the repository's Prettier formatting.                                          |
| `npm run lint`         | Check JavaScript with ESLint; warnings fail the check.                               |
| `npm run typecheck`    | Check JavaScript and JSDoc with TypeScript's strict settings, without emitting code. |
| `npm run test:unit`    | Run URL extraction tests.                                                            |
| `npm run test:build`   | Run archive and build-failure regression tests.                                      |
| `npm run test:browser` | Build and load the XPI in headless Firefox using Selenium.                           |
| `npm run build`        | Write the unsigned XPI and source ZIP to `dist/`.                                    |

`npm test` runs unit and packaging tests and checks 100% statement, branch, function,
and line coverage for **`extension/redirect.js`**. This coverage target applies to the
URL parser; the actual Firefox registration is exercised by browser tests.

The browser tests use a local HTTP server and map `p8zh.adj.st` to loopback in an
isolated Firefox profile. They check direct navigation, clicked links, new tabs, nested
wrappers, URL encoding, frames, and unresolved links. They do not open live shopping
pages. Selenium Manager locates or downloads geckodriver. Set `FIREFOX_BINARY` and,
optionally, `GECKODRIVER` to use specific executable paths.

CI runs source checks and archive tests on Linux and Windows, and browser tests on
Firefox 140.0 and the current Firefox release. `npm start` launches Firefox with the
unpacked extension for interactive development.

## Code structure

- `extension/redirect.js` contains URL extraction and has no Firefox dependency.
- `extension/background.js` registers the typed, synchronous request handler.
- `scripts/build.js` is the build command; `scripts/lib/build.js` validates inputs and
  creates archives with `fflate`.
- `tests/` covers URL behavior and packaging; `tests/browser/` exercises the XPI.
- `types/selenium-webdriver.d.ts` supplies a current Selenium API missing from the
  upstream type definitions. It is used only by development checks.

Keep parsing local and preserve the destination's existing encoding. Cover changed
behavior with a focused example. Use synthetic fixtures without personal tracking
values. Avoid adding abstractions or dependencies to the extension runtime for build or
test concerns.

## Packaging

`package.json`'s `files` array is the source archive's explicit input list. A missing
listed input is an error. Symlinks, including symlinked parent directories, are
rejected. Git metadata, installed dependencies, caches, existing downloads, and output
archives are excluded from the configured source inputs.

The build reads both distributions from the same source snapshot. It validates all
inputs and compresses both archives before writing output, then stages files in `dist/`
and atomically replaces each completed artifact. Input validation failures leave
previous artifacts untouched. ZIP file order, timestamps, and permissions are fixed for
reproducible builds.

```text
dist/p8zh-direct-<version>.xpi
dist/p8zh-direct-<version>-source.zip
```

The XPI contains the extension files and MIT license. The source ZIP includes the code,
lockfile, test fixtures, and check configuration needed to rebuild it after `npm ci`.

## Releases

Use a numeric `major.minor.patch` version, with each component between 0 and 65535 and
no leading zeros. Set matching versions in `package.json` and `extension/manifest.json`,
then run `npm install --package-lock-only` to update both lockfile version fields. The
build checks all four values.

Update the changelog, run `npm run check`, `npm run test:browser`, and `npm run build`,
and commit the release changes. Create a version tag and GitHub release pointing to that
commit. Link or attach the XPI and source ZIP, and explain that unsigned builds require
temporary installation. Keep published tags and artifacts unchanged. Mozilla signing is
covered in [docs/amo.md](docs/amo.md).
