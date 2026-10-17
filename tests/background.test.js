import assert from "node:assert/strict";
import test from "node:test";

test("redirects top-level requests and leaves other requests unchanged", async () => {
  let registration;
  globalThis.browser = {
    webRequest: {
      onBeforeRequest: {
        addListener(listener, filter, options) {
          registration = { listener, filter, options };
        },
      },
    },
  };

  try {
    await import("../extension/background.js");
  } finally {
    delete globalThis.browser;
  }

  assert.deepEqual(registration.filter, {
    urls: ["*://p8zh.adj.st/*"],
    types: ["main_frame"],
  });
  assert.deepEqual(registration.options, ["blocking"]);

  const url = "https://p8zh.adj.st/example?adjust_redirect=https%3A%2F%2Fexample.com";
  assert.deepEqual(registration.listener({ url, type: "main_frame" }), {
    redirectUrl: "https://example.com/",
  });

  for (const type of ["sub_frame", "image", "script", "xmlhttprequest"]) {
    assert.deepEqual(registration.listener({ url, type }), {});
  }
  assert.deepEqual(
    registration.listener({ url: "https://p8zh.adj.st/", type: "main_frame" }),
    {},
  );
});
