import "selenium-webdriver/firefox.js";

declare module "selenium-webdriver/firefox.js" {
  interface Driver {
    installWebExtension(
      extension: string,
      options?: { permanent?: boolean; allowPrivateBrowsing?: boolean },
    ): Promise<unknown>;
  }
}
