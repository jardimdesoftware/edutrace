import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  COMPLETE_REGISTRATION_PAGE,
  registrationRedirect,
  showHeader,
} from "./registrationRedirect";

describe("registrationRedirect", () => {
  const pending = { must_complete_registration: true };
  const complete = { must_complete_registration: false };

  it("sends a pending account from any page to the registration page", () => {
    for (const pathname of ["/", "/login", "/home", "/alterar-dados", "/admin/usuarios"]) {
      assert.equal(registrationRedirect(pending, pathname), COMPLETE_REGISTRATION_PAGE, pathname);
    }
  });

  it("keeps a pending account on the registration page", () => {
    assert.equal(registrationRedirect(pending, COMPLETE_REGISTRATION_PAGE), null);
  });

  it("does not redirect an account with complete registration", () => {
    assert.equal(registrationRedirect(complete, "/home"), null);
    assert.equal(registrationRedirect({}, "/home"), null);
  });

  it("sends an account with complete registration away from the registration page", () => {
    assert.equal(registrationRedirect(complete, COMPLETE_REGISTRATION_PAGE), "/home");
  });
});

describe("showHeader", () => {
  it("hides the header while the registration is pending", () => {
    assert.equal(showHeader({ must_complete_registration: true }), false);
  });

  it("shows the header once the registration is complete", () => {
    assert.equal(showHeader({ must_complete_registration: false }), true);
    assert.equal(showHeader({}), true);
    assert.equal(showHeader(null), true);
  });
});
