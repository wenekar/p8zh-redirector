# Mozilla Add-ons submission

GitHub releases contain unsigned development builds. Mozilla signing is required
for permanent installation in regular Firefox. The extension is not yet listed
on Mozilla Add-ons (AMO).

## Prepare a build

1. Set matching versions in `extension/manifest.json` and `package.json`, and
   refresh the lockfile with `npm install --package-lock-only`.
2. Run `npm ci`, `npm run check`, and `npm run build`.
3. Test the resulting XPI in Firefox, including a clicked link from another site.
4. Upload `dist/p8zh-direct-<version>.xpi` through the
   [AMO Developer Hub](https://addons.mozilla.org/developers/).

Choose **On this site** for a public AMO listing. An unlisted distribution can
provide a signed XPI without a public listing. Complete the required listing,
license, support, and data-collection information, then address Mozilla's
validation or review feedback. Use [PRIVACY.md](../PRIVACY.md) as the project's
privacy policy; the manifest declares that the extension collects no data.

Do not change the existing `browser_specific_settings.gecko.id` when submitting
updates. Future AMO submissions need a higher extension version.

## Notes for reviewers

- The extension handles top-level HTTP(S) requests to `p8zh.adj.st` only.
- `webRequest` and `webRequestBlocking` let the background handler return a
  website URL extracted from the request's `adjust_redirect` parameter.
- URL parsing is local. There is no data collection, storage, remote code, or
  background network access initiated by the extension.
- Destination query parameters are retained. Missing or invalid destinations
  leave normal navigation unchanged.
- JavaScript is readable source. There is no bundling, minification, transpilation,
  or generated JavaScript. Packaging only creates ZIP archives.
- The source ZIP and build instructions are available if reviewers request them.

Successful local validation does not guarantee AMO approval. Publish the signed
XPI or link to the AMO listing after Mozilla completes its process.
