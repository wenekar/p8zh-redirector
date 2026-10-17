"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

let registration;
const context = vm.createContext({
  URL,
  browser: {
    webRequest: {
      onBeforeRequest: {
        addListener(listener, filter, options) {
          registration = { listener, filter, options };
        }
      }
    }
  }
});
vm.runInContext(
  fs.readFileSync(path.join(__dirname, "../extension/background.js"), "utf8"),
  context
);
const extractTargetUrl = vm.runInContext("extractTargetUrl", context);
const wrap = (target) =>
  `https://p8zh.adj.st/25l4ri4o_25q1bx32?adjust_redirect=${encodeURIComponent(target)}`;

test("extracts the complete destination from the user's example", () => {
  const source = fs.readFileSync(path.join(__dirname, "fixtures/example-url.txt"), "utf8").trim();
  const expected = "https://www.trendyol.com/Heifer/Uzaktan-Kumandali-Ayakli-Kanatsiz-Fan---35-Watt-p-1155576039?boutiqueId=61&merchantId=1004942&adjust_t=25l4ri4o_25q1bx32&adjust_tracker_limit=999999999&utm_source=share&adjust_creative=1155576039&adjust_campaign=product_free_20261017729_TR&utm_term=73809120&utm_campaign=1155576039&utm_medium=product_free&adjust_adgroup=73809120&link_contentid=1155576039&link_userID=73809120&timestamp=1792221347";
  assert.equal(extractTargetUrl(source), expected);
  assert.equal(registration.listener({ url: source, type: "main_frame" }).redirectUrl, expected);
});

test("preserves target escapes, plus signs, query parameters, and fragments", () => {
  const target = "https://example.com/a%2Fb?next=%2Fitem%3Fx%3D1&literal=%2520&plus=a%2Bb&space=a+b#details";
  assert.equal(extractTargetUrl(wrap(target)), target);
});

test("handles HTTP links, any path, and any parameter position", () => {
  const target = "http://example.com:8080/product?a=1&b=2";
  const source = `http://p8zh.adj.st/anything?unrelated=1&adjust_redirect=${encodeURIComponent(target)}&other=2`;
  assert.equal(extractTargetUrl(source), target);
});

test("handles Unicode and normal URL normalization", () => {
  const target = "https://example.com/ürün?q=çay";
  assert.equal(extractTargetUrl(wrap(target)), new URL(target).href);
});

test("unwraps up to five nested p8zh links", () => {
  const target = "https://example.com/product";
  let source = target;
  for (let count = 0; count < 5; count += 1) source = wrap(source);
  assert.equal(extractTargetUrl(source), target);
  assert.equal(extractTargetUrl(wrap(source)), null);
});

test("leaves missing, malformed, relative, and non-web destinations alone", () => {
  const sources = [
    "not a URL",
    "https://p8zh.adj.st/anything",
    "https://p8zh.adj.st/?adjust_redirect=",
    "https://p8zh.adj.st/?adjust_redirect=%E0%A4%A",
    wrap("/product/123"),
    wrap("//example.com/product"),
    wrap("https://"),
    wrap("javascript:alert(1)"),
    wrap("data:text/html,example"),
    wrap("file:///tmp/example.html"),
    wrap("ty://?ContentId=123"),
    wrap("https%3A%2F%2Fexample.com"),
    wrap("https://user:password@example.com/"),
    wrap("https://p8zh.adj.st/?adjust_redirect="),
    wrap("https://p8zh.adj.st/anything")
  ];
  for (const source of sources) assert.equal(extractTargetUrl(source), null, source);
});

test("only recognizes the exact p8zh.adj.st source hostname", () => {
  for (const source of [
    "https://p8zh.adj.st.example.com/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://other.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://example.com/?adjust_redirect=https%3A%2F%2Fexample.org",
    "ftp://p8zh.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://user:pass@p8zh.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com"
  ]) assert.equal(extractTargetUrl(source), null, source);
});

test("registers a synchronous, blocking listener limited to main-frame p8zh requests", () => {
  assert.deepEqual(JSON.parse(JSON.stringify(registration.filter)), {
    urls: ["*://p8zh.adj.st/*"], types: ["main_frame"]
  });
  assert.deepEqual(Array.from(registration.options), ["blocking"]);
  assert.equal(registration.listener({ url: wrap("https://example.com"), type: "main_frame" }).redirectUrl, "https://example.com/");
});

test("ignores frames, images, scripts, and requests without a valid target", () => {
  for (const type of ["sub_frame", "image", "script", "xmlhttprequest"])
    assert.equal(Object.keys(registration.listener({ url: wrap("https://example.com"), type })).length, 0);
  assert.equal(Object.keys(registration.listener({ url: "https://p8zh.adj.st/", type: "main_frame" })).length, 0);
});
