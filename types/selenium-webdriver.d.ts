import "selenium-webdriver/firefox.js";

// Selenium 4.51 exposes this API; @types/selenium-webdriver 4.35.7 omits it.
declare module "selenium-webdriver/firefox.js" {
  interface Driver {
    installWebExtension(
      extension: string,
      options?: { permanent?: boolean; allowPrivateBrowsing?: boolean },
    ): Promise<unknown>;
  }
}
