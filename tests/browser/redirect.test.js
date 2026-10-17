import assert from "node:assert/strict";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { By, until } from "selenium-webdriver";
import { Driver, Options, ServiceBuilder } from "selenium-webdriver/firefox.js";
import { buildProject } from "../../scripts/build.js";

/** @typedef {Driver & {
 * installWebExtension: (
 *   extension: string,
 *   options?: { permanent?: boolean; allowPrivateBrowsing?: boolean },
 * ) => Promise<unknown>
 * }} ExtensionDriver
 */

test("the packaged extension redirects in Firefox", { timeout: 180_000 }, async (t) => {
  /** @type {string[]} */
  const requests = [];
  let wrapper = "";
  const server = createServer((request, response) => {
    const path = request.url ?? "/";
    requests.push(path);
    const link = wrapper.replaceAll("&", "&amp;");
    let html = '<p id="destination">Destination</p>';
    if (path === "/start") {
      html = `<a id="same" href="${link}">Same tab</a><a id="new" target="_blank" href="${link}">New tab</a>`;
    } else if (path === "/frame") {
      html = `<iframe src="${link}"></iframe>`;
    } else if (path.startsWith("/wrapper")) {
      html = '<p id="wrapper">Wrapper</p>';
    }
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(html);
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(undefined));
  });
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve(undefined)));
    });
  });
  const address = server.address();
  assert.ok(address !== null && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const source = `http://p8zh.adj.st:${address.port}`;
  const target = `${base}/destination?merchantId=100000&next=%2Fitem&plus=a%2Bb#details`;
  wrapper = `${source}/wrapper?adjust_redirect=${encodeURIComponent(target)}`;

  const options = new Options()
    .addArguments("-headless")
    .setPreference("network.dns.localDomains", "p8zh.adj.st")
    .setPreference("network.proxy.no_proxies_on", "127.0.0.1,localhost,p8zh.adj.st")
    .setPreference("datareporting.policy.dataSubmissionEnabled", false);
  if (process.env.FIREFOX_BINARY) {
    options.setBinary(process.env.FIREFOX_BINARY);
  }
  const service = process.env.GECKODRIVER
    ? new ServiceBuilder(process.env.GECKODRIVER).build()
    : undefined;
  const driver = Driver.createSession(options, service);
  const extensionDriver = /** @type {ExtensionDriver} */ (driver);
  t.after(() => driver.quit());
  await driver.manage().setTimeouts({ pageLoad: 15_000, script: 5_000 });
  const root = fileURLToPath(new URL("../../", import.meta.url));
  const { xpi } = await buildProject(root);
  await extensionDriver.installWebExtension(xpi, { permanent: false });
  t.diagnostic(`Firefox ${(await driver.getCapabilities()).get("browserVersion")}`);

  function assertWrapperNotContacted() {
    assert.equal(
      requests.some((path) => path.startsWith("/wrapper")),
      false,
    );
  }

  await t.test(
    "address-bar navigation preserves the complete destination",
    async () => {
      requests.length = 0;
      await driver.get(wrapper);
      assert.equal(await driver.getCurrentUrl(), target);
      assertWrapperNotContacted();
    },
  );

  await t.test("a clicked link from another origin redirects", async () => {
    await driver.get(`${base}/start`);
    requests.length = 0;
    await driver.findElement(By.id("same")).click();
    await driver.wait(until.urlIs(target), 5_000);
    assertWrapperNotContacted();
  });

  await t.test("a link opened in a new tab redirects", async () => {
    await driver.get(`${base}/start`);
    const original = await driver.getWindowHandle();
    requests.length = 0;
    await driver.findElement(By.id("new")).click();
    await driver.wait(
      async () => (await driver.getAllWindowHandles()).length === 2,
      5_000,
    );
    const opened = (await driver.getAllWindowHandles()).find(
      (handle) => handle !== original,
    );
    assert.ok(opened);
    try {
      await driver.switchTo().window(opened);
      await driver.wait(until.urlIs(target), 5_000);
      assertWrapperNotContacted();
    } finally {
      await driver.close();
      await driver.switchTo().window(original);
    }
  });

  await t.test("nested wrappers resolve before any wrapper is contacted", async () => {
    const nested = `${source}/wrapper?adjust_redirect=${encodeURIComponent(wrapper)}`;
    requests.length = 0;
    await driver.get(nested);
    assert.equal(await driver.getCurrentUrl(), target);
    assertWrapperNotContacted();
  });

  await t.test("embedded frames retain normal navigation", async () => {
    requests.length = 0;
    await driver.get(`${base}/frame`);
    assert.equal(await driver.getCurrentUrl(), `${base}/frame`);
    assert.ok(requests.some((path) => path.startsWith("/wrapper")));
    await driver.switchTo().frame(0);
    try {
      assert.equal(await driver.findElement(By.id("wrapper")).getText(), "Wrapper");
    } finally {
      await driver.switchTo().defaultContent();
    }
  });

  await t.test("missing and app-only destinations keep normal navigation", async () => {
    for (const url of [
      `${source}/missing`,
      `${source}/app?adjust_redirect=ty%3A%2F%2F`,
    ]) {
      await driver.get(url);
      assert.equal(await driver.getCurrentUrl(), url);
    }
  });
});
