"use strict";

const P8ZH_HOST = "p8zh.adj.st";
const MAX_WRAPPERS = 5;

/** Decode only the outer query, preserving the target's own URL encoding. */
function extractTargetUrl(sourceUrl) {
  try {
    let current = new URL(sourceUrl);

    for (let depth = 0; depth < MAX_WRAPPERS; depth += 1) {
      if (
        !["https:", "http:"].includes(current.protocol) ||
        current.hostname !== P8ZH_HOST ||
        current.username ||
        current.password
      ) {
        return null;
      }

      // URLSearchParams already performs the required percent decoding.
      const value = current.searchParams.get("adjust_redirect");
      if (!value) {
        return null;
      }

      // No base URL: relative destinations and app-only deep links are rejected.
      const target = new URL(value);
      if (
        !["https:", "http:"].includes(target.protocol) ||
        target.username ||
        target.password
      ) {
        return null;
      }

      if (target.hostname !== P8ZH_HOST) {
        return target.href;
      }

      // Unwrap nested p8zh links without creating a browser redirect loop.
      current = target;
    }
  } catch {
    // Missing or malformed destinations retain Firefox's normal behavior.
  }

  return null;
}

function redirectRequest(details) {
  if (details.type !== "main_frame") {
    return {};
  }

  const redirectUrl = extractTargetUrl(details.url);
  return redirectUrl ? { redirectUrl } : {};
}

// Register synchronously so Firefox can wake the Manifest V3 event page.
browser.webRequest.onBeforeRequest.addListener(
  redirectRequest,
  { urls: ["*://p8zh.adj.st/*"], types: ["main_frame"] },
  ["blocking"]
);
