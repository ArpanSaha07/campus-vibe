import { hasRole, isAdmin, isRegularUser } from "@/app/lib/user";
import { Role, type User } from "@/app/types";

function userWith(roles: Role[]): User {
  return {
    id: 1,
    name: "Test",
    email: "test@campus.com",
    roles,
    createdAt: "2026-01-01T00:00:00Z",
    emailVerified: true,
    authProvider: "LOCAL",
  };
}

describe("role helpers", () => {
  it("every authenticated user has ROLE_USER", () => {
    const user = userWith([Role.USER]);
    expect(hasRole(user, Role.USER)).toBe(true);
    expect(isRegularUser(user)).toBe(true);
    expect(isAdmin(user)).toBe(false);
  });

  it("admins also keep ROLE_USER", () => {
    const user = userWith([Role.USER, Role.ADMIN]);
    expect(isAdmin(user)).toBe(true);
    expect(isRegularUser(user)).toBe(false);
  });

  it("handles null user safely", () => {
    expect(hasRole(null, Role.USER)).toBe(false);
    expect(isAdmin(null)).toBe(false);
    expect(isRegularUser(null)).toBe(false);
  });

  it("role values match the backend role names", () => {
    expect(Role.USER).toBe("ROLE_USER");
    expect(Role.ADMIN).toBe("ROLE_ADMIN");
  });

  /**
   * ROLE_CLUB_ADMIN was removed in V14 — club authority is a per-club
   * assignment read from the server, not a claim on the account. This pins the
   * enum shut so it cannot come back by habit: a role in the token outlives the
   * access it describes, which is the bug the whole change exists to fix.
   */
  it("has no club-admin platform role", () => {
    expect(Object.values(Role)).toEqual(["ROLE_USER", "ROLE_ADMIN"]);
    expect(Object.values(Role)).not.toContain("ROLE_CLUB_ADMIN");
  });
});
