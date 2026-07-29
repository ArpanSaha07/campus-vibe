import { hasRole, isAdmin, isClubAdmin, isRegularUser } from "@/app/lib/user";
import { Role, type User } from "@/app/types";

function userWith(roles: Role[]): User {
  return {
    id: 1,
    name: "Test",
    email: "test@campus.com",
    roles,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

describe("role helpers", () => {
  it("every authenticated user has ROLE_USER", () => {
    const user = userWith([Role.USER]);
    expect(hasRole(user, Role.USER)).toBe(true);
    expect(isRegularUser(user)).toBe(true);
    expect(isClubAdmin(user)).toBe(false);
    expect(isAdmin(user)).toBe(false);
  });

  it("club admins also keep ROLE_USER", () => {
    const user = userWith([Role.USER, Role.CLUB_ADMIN]);
    expect(hasRole(user, Role.USER)).toBe(true);
    expect(isClubAdmin(user)).toBe(true);
    expect(isRegularUser(user)).toBe(false);
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
    expect(isClubAdmin(null)).toBe(false);
    expect(isRegularUser(null)).toBe(false);
  });

  it("role values match the backend role names", () => {
    expect(Role.USER).toBe("ROLE_USER");
    expect(Role.CLUB_ADMIN).toBe("ROLE_CLUB_ADMIN");
    expect(Role.ADMIN).toBe("ROLE_ADMIN");
  });
});
