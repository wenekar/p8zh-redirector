# p8zh Direct

A small Firefox extension that automatically opens the website embedded in a
`p8zh.adj.st` link's `adjust_redirect` query parameter. The desktop installation
below requires Firefox 140 or newer. It runs in the background; there is no
toolbar button to click.

## Install for immediate use

The [latest release](https://github.com/wenekar/p8zh-redirector/releases/latest)
also includes a download link for the unsigned XPI. Select that file in step 3
if you prefer it to installing from the source folder.

1. [Download the source ZIP](https://github.com/wenekar/p8zh-redirector/archive/refs/heads/main.zip)
   and extract it, or clone this repository.
2. In Firefox, open **about:debugging#/runtime/this-firefox**.
3. Choose **Load Temporary Add-on…** and select `extension/manifest.json` inside
   the extracted folder.
4. Open a `p8zh.adj.st` link, including the example in `tests/fixtures/example-url.txt`.
   Firefox should go directly to its embedded destination.

You can also build `dist/p8zh-direct-1.0.0.xpi` using `python3 scripts/package.py`
and select that file in step 3. If Firefox asks for access to `p8zh.adj.st`, allow
it. If redirection is disabled, check this extension's site permissions in
**about:addons**. Private windows require enabling **Run in Private Windows** in
the extension's settings.

**Temporary add-ons are removed when Firefox closes.** This build is unsigned,
so it cannot be installed permanently in regular Firefox. For permanent use,
submit the contents of `extension/` (or the XPI) to
[Mozilla Add-ons](https://addons.mozilla.org/developers/) for signing. Choose an
unlisted distribution if you want to keep the add-on off the public directory,
then install the signed XPI Mozilla provides. No Firefox security settings need
to be changed.

## Behavior

- Handles HTTP and HTTPS navigation to the exact hostname `p8zh.adj.st`.
- Redirects before the intermediary page loads using Firefox's blocking
  `webRequest.onBeforeRequest` API, including links pasted in the address bar,
  clicked links, and links opened in new tabs.
- Reads `adjust_redirect` with `URLSearchParams`, which decodes the outer query
  parameter once. Preserves the destination's query parameters, URL escapes, and
  fragment; Firefox applies normal URL normalization.
- Follows up to five nested p8zh wrappers without a redirect loop.
- Leaves missing or invalid destinations unchanged. Only absolute HTTP and HTTPS
  destinations without embedded usernames or passwords are accepted. App deep
  links such as `ty://` are not website destinations.
- Only redirects top-level pages. Images, scripts, API requests, and embedded
  frames are unaffected.
- Does not resolve links that lack an embedded `adjust_redirect` destination.
- Does not remove tracking parameters from the destination URL.

For the supplied example, the destination is the Trendyol product page at:

```text
https://www.trendyol.com/Heifer/Uzaktan-Kumandali-Ayakli-Kanatsiz-Fan---35-Watt-p-1155576039
```

The original destination's `boutiqueId`, `merchantId`, and other query
parameters are retained.

## Validation

The nine automated tests cover the complete supplied example, URL encoding,
nested wrappers, invalid destinations, source host matching, and request scope.
The extension also passed Mozilla's `web-ext lint` with no errors, warnings, or
notices. A Firefox 153 smoke test verified direct navigation, clicks from another
origin, interception before the wrapper is contacted, unchanged embedded frames,
and normal navigation when the destination is missing. Browser checks used a
local test server; they did not open the live Trendyol product page.

## Permissions and privacy

The extension requests `webRequest` and `webRequestBlocking` to redirect page
requests, plus host access scoped to `p8zh.adj.st`. It does not request access to
all websites, browsing history, cookies, or storage. It contains no analytics,
telemetry, remote code, or network fetches, and does not collect or send data.
The destination website still receives its normal navigation request.

## Development

The extension itself has no runtime dependencies. Node.js 22+ runs the tests;
Python 3 builds the archives. `web-ext` is used only for Mozilla's extension
validation.

```sh
npm ci
npm test
npm run lint:extension
npm run build
```

Install development tooling with `npm install` if no lockfile is present.
Build output is in `dist/`. The XPI includes `manifest.json`, `background.js`, and
the MIT license; tests and development tools are included only in the source
bundle.
