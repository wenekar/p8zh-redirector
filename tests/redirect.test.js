import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { extractTargetUrl } from "../extension/redirect.js";

const wrap = (target) =>
  `https://p8zh.adj.st/example?adjust_redirect=${encodeURIComponent(target)}`;

test("extracts the website from a share link containing an app deep link", () => {
  const source = readFileSync(new URL("./fixtures/share-url.txt", import.meta.url), "utf8").trim();
  const expected =
    "https://www.trendyol.com/example-product-p-123456789" +
    "?boutiqueId=61&merchantId=100000&utm_source=share";
  assert.equal(extractTargetUrl(source), expected);
});

test("preserves destination escapes, plus signs, parameters, and fragments", () => {
  const target =
    "https://example.com/a%2Fb?next=%2Fitem%3Fx%3D1" +
    "&literal=%2520&plus=a%2Bb&space=a+b#details";
  assert.equal(extractTargetUrl(wrap(target)), target);
});

test("handles HTTP, non-default ports, and any parameter position", () => {
  const target = "http://example.com:8080/product?a=1&b=2";
  const source =
    "http://p8zh.adj.st/anything?unrelated=1" +
    `&adjust_redirect=${encodeURIComponent(target)}&other=2`;
  assert.equal(extractTargetUrl(source), target);
});

test("applies normal URL normalization for Unicode and hostnames", () => {
  const target = "https://EXAMPLE.COM/ürün?q=çay";
  assert.equal(extractTargetUrl(wrap(target)), new URL(target).href);
});

test("unwraps five nested links and leaves deeper chains unchanged", () => {
  const target = "https://example.com/product";
  let source = target;
  for (let count = 0; count < 5; count += 1) {
    source = wrap(source);
  }
  assert.equal(extractTargetUrl(source), target);
  assert.equal(extractTargetUrl(wrap(source)), null);
});

test("uses the first adjust_redirect value consistently", () => {
  const source = `${wrap("https://example.com/first")}&adjust_redirect=https://example.org/second`;
  assert.equal(extractTargetUrl(source), "https://example.com/first");
});

test("leaves missing, malformed, relative, and non-web destinations unchanged", () => {
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
    wrap("https://p8zh.adj.st/anything"),
  ];
  for (const source of sources) {
    assert.equal(extractTargetUrl(source), null, source);
  }
});

test("only recognizes HTTP(S) sources on the exact p8zh.adj.st hostname", () => {
  const sources = [
    "https://p8zh.adj.st.example.com/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://other.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://example.com/?adjust_redirect=https%3A%2F%2Fexample.org",
    "ftp://p8zh.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com",
    "https://user:pass@p8zh.adj.st/?adjust_redirect=https%3A%2F%2Fexample.com",
  ];
  for (const source of sources) {
    assert.equal(extractTargetUrl(source), null, source);
  }
});
