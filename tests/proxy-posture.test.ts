// Regression test for the production reverse-proxy boot guard.
//
// Vercel always serves requests through its edge proxy, which adds
// `x-forwarded-for`. In production, DaloyJS refuses to dispatch a request
// carrying `X-Forwarded-*` unless the app declares a proxy posture — without
// `behindProxy` it returns a 500 on every request. The app's `production`
// flag is resolved at construction time, so this file sets `NODE_ENV` before
// importing the handler (the test runner isolates each file in its own
// process). The handler is imported dynamically so it loads *after* the env
// is set.
process.env.NODE_ENV = "production";

import assert from "node:assert/strict";
import test from "node:test";

test("production request carrying x-forwarded-for returns 200, not 500", async () => {
  const { default: handler } = await import("../api/index.ts");
  const res = await handler.fetch(
    new Request("https://example.test/healthz", {
      headers: { "x-forwarded-for": "203.0.113.7, 70.41.3.18" },
    }),
  );
  assert.equal(res.status, 200);
  assert.equal((await res.json()).runtime, "vercel");
});
