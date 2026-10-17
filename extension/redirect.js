export const REDIRECT_HOST = "p8zh.adj.st";

const MAX_WRAPPERS = 5;

/**
 * @param {string | null} value
 * @returns {URL | null}
 */
function parseWebUrl(value) {
  const url = value === null ? null : URL.parse(value);
  if (
    url === null ||
    (url.protocol !== "https:" && url.protocol !== "http:") ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return null;
  }
  return url;
}

/**
 * Extract a website destination from up to five nested p8zh wrappers.
 *
 * URLSearchParams decodes each wrapper once. Decoding the destination again
 * would corrupt its own escaped query parameters and path segments.
 *
 * @param {string} sourceUrl - The URL of a top-level navigation.
 * @returns {string | null} The destination, or null to leave navigation alone.
 */
export function extractTargetUrl(sourceUrl) {
  let current = parseWebUrl(sourceUrl);

  for (let depth = 0; depth < MAX_WRAPPERS; depth += 1) {
    if (!current || current.hostname !== REDIRECT_HOST) {
      return null;
    }

    const target = parseWebUrl(current.searchParams.get("adjust_redirect"));
    if (!target) {
      return null;
    }

    if (target.hostname !== REDIRECT_HOST) {
      return target.href;
    }

    current = target;
  }

  return null;
}
