import { describe, expect, it } from "vitest";
import { resolveAccessFlags } from "@/lib/access";

describe("resolveAccessFlags", () => {
  it("does not grant superadmin access to institutional admins", () => {
    expect(resolveAccessFlags(["admin"])).toEqual({
      isSuperAdmin: false,
      isInstitutionAdmin: true,
      isTeamMember: false,
    });
  });

  it("grants global access only for the explicit superadmin role", () => {
    expect(resolveAccessFlags(["superadmin"])).toEqual({
      isSuperAdmin: true,
      isInstitutionAdmin: false,
      isTeamMember: false,
    });
  });

  it("preserves independent flags for multiple roles", () => {
    expect(resolveAccessFlags(["superadmin", "admin", "equipe"])).toEqual({
      isSuperAdmin: true,
      isInstitutionAdmin: true,
      isTeamMember: true,
    });
  });

  it("does not grant access without roles", () => {
    expect(resolveAccessFlags([])).toEqual({
      isSuperAdmin: false,
      isInstitutionAdmin: false,
      isTeamMember: false,
    });
  });
});
