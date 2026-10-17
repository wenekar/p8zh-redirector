import { extractTargetUrl, REDIRECT_HOST } from "./redirect.js";

/** Returns a redirect response for a supported p8zh link.
 * @param {browser.webRequest._OnBeforeRequestDetails} details
 * @returns {browser.webRequest.BlockingResponse}
 */
function redirectRequest(details) {
  const redirectUrl = extractTargetUrl(details.url);
  return redirectUrl ? { redirectUrl } : {};
}

browser.webRequest.onBeforeRequest.addListener(
  redirectRequest,
  { urls: [`*://${REDIRECT_HOST}/*`], types: ["main_frame"] },
  ["blocking"],
);
