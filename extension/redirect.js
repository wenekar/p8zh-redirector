export const REDIRECT_HOST = "p8zh.adj.st";

const MAX_WRAPPERS = 5;

/** Parses an HTTP(S) URL without embedded credentials.
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

/** Extracts the HTTP(S) destination from up to five nested p8zh URLs.
 * @param {string} sourceUrl
 * @returns {string | null}
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
