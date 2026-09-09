import assert from "node:assert/strict";
import { test } from "node:test";
import { oauthReturnPath } from "./oauthReturn.js";

test("OAuth login returns only to a local consent request", () => {
  const id = "c3d6ac7e-2a64-4658-8559-264dcf5dd34a";
  assert.equal(oauthReturnPath(`?oauthRequest=${id}`), `/oauth/consent?request=${id}`);
  for (const search of ["", "?oauthRequest=https://evil.example", "?oauthRequest=//evil.example", "?returnUrl=https://evil.example"]) {
    assert.equal(oauthReturnPath(search), "/");
  }
});

test("Preview login returns only to a numeric preview route", () => {
  assert.equal(oauthReturnPath("?preview=4800"), "/previews/4800");
  for (const id of ["0", "-1", "//evil.example", "4800/../../settings", "abc"]) {
    assert.equal(oauthReturnPath(`?preview=${encodeURIComponent(id)}`), "/");
  }
});
