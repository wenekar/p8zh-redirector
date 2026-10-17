import { extractTargetUrl, REDIRECT_HOST } from "./redirect.js";

/**
 * @param {browser.webRequest._OnBeforeRequestDetails} details
 * @returns {browser.webRequest.BlockingResponse}
 */
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
  { urls: [`*://${REDIRECT_HOST}/*`], types: ["main_frame"] },
  ["blocking"],
);
