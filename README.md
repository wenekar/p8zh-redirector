# p8zh Direct

A Firefox extension that opens the website embedded in `p8zh.adj.st` share links.
It reads the `adjust_redirect` parameter and redirects automatically, without a
toolbar button or setup screen.

```text
https://p8zh.adj.st/example?adjust_redirect=https%3A%2F%2Fexample.com%2Fproduct
                                      ↓
https://example.com/product
```

## Installation

Requires **Firefox 140 or newer on desktop**. The extension is not yet listed on
Mozilla Add-ons; current GitHub builds are unsigned.

1. Open the [latest release](https://github.com/wenekar/p8zh-redirector/releases/latest)
   and download the XPI using the link in its release notes.
2. In Firefox, open `about:debugging#/runtime/this-firefox`.
3. Choose **Load Temporary Add-on…** and select the downloaded `.xpi`.
4. Open a `p8zh.adj.st` link. Firefox opens its embedded website destination.

Temporary add-ons are removed when Firefox closes. Permanent installation in
regular Firefox requires a Mozilla-signed build. See the
[AMO submission guide](docs/amo.md) for the submission process.

To try the source directly, clone this repository or extract a
[source ZIP](https://github.com/wenekar/p8zh-redirector/archive/refs/heads/main.zip),
then select `extension/manifest.json` in step 3. No build or dependencies are
needed to load the source.

If links do not redirect, check the extension's access to `p8zh.adj.st` in
`about:addons` and reload the link. Private windows require enabling **Run in
Private Windows** in the extension's settings.

## Behavior

- Intercepts top-level HTTP and HTTPS navigation to the exact host `p8zh.adj.st`.
- Uses the first `adjust_redirect` parameter and decodes each wrapper once.
- Preserves the destination's query parameters, URL escapes, and fragment,
  subject to Firefox's normal URL normalization.
- Resolves up to five nested p8zh links.
- Leaves navigation unchanged when the destination is missing, malformed,
  relative, uses an app scheme such as `ty://`, contains embedded credentials,
  or exceeds the nesting limit.

Images, scripts, API requests, and embedded frames are unaffected. Links without
an embedded website destination cannot be resolved locally. Destination tracking
parameters are preserved.

## Permissions and privacy

| Permission | Purpose |
| --- | --- |
| `webRequest` | Observe matching navigation requests. |
| `webRequestBlocking` | Redirect before the intermediary page loads. |
| `*://p8zh.adj.st/*` | Limit access to the supported link host. |

The extension does not collect, store, or transmit browsing data. URL extraction
happens locally; the destination receives a normal browser navigation, including
its existing query parameters. See [PRIVACY.md](PRIVACY.md) for details.

## Development

Use Node.js 22+ and Python 3.10+. There are no runtime dependencies, bundlers, or
transpilers. `web-ext` is a development dependency used to validate and run the
extension.

```sh
npm ci
npm run check
npm run build
```

`npm run check` runs the JavaScript tests, packaging tests, and Mozilla extension
validation. `npm run build` writes a versioned unsigned XPI and source ZIP to
`dist/`. The version comes from `extension/manifest.json` and must match
`package.json`.

See [CONTRIBUTING.md](CONTRIBUTING.md) for the project structure, manual browser
checks, and release steps. Report problems through
[GitHub Issues](https://github.com/wenekar/p8zh-redirector/issues), including your
Firefox version and a minimal link with personal tracking values removed.

## License

[MIT](LICENSE). Independent project; not affiliated with Mozilla, Adjust, or
Trendyol.
