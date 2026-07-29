import { apiFetch, setToken, clearToken } from "./api";
import { Role, type AuthResponse, type User } from "@/app/types";

export async function login(email: string, password: string): Promise<User> {
	const res = await apiFetch<AuthResponse>(`/api/v1/auth/login`, {
		method: "POST",
		body: JSON.stringify({ email, password }),
	});
	setToken(res.token);
	return res.user;
}

export async function register(name: string, email: string, password: string): Promise<User> {
	const res = await apiFetch<AuthResponse>(`/api/v1/auth/register`, {
		method: "POST",
		body: JSON.stringify({ name, email, password }),
	});
	setToken(res.token);
	return res.user;
}

export async function googleSignIn(idToken: string): Promise<User> {
	const res = await apiFetch<AuthResponse>(`/api/v1/auth/google`, {
		method: "POST",
		body: JSON.stringify({ idToken }),
	});
	setToken(res.token);
	return res.user;
}

export async function me(): Promise<User> {
	return apiFetch<User>(`/api/v1/users/me`, { auth: true });
}

// Role helpers. Every authenticated user has ROLE_USER; visibility only —
// the backend enforces all authorization.
export function hasRole(user: User | null, role: Role): boolean {
	return !!user?.roles?.includes(role);
}

export function isAdmin(user: User | null): boolean {
	return hasRole(user, Role.ADMIN);
}

export function isClubAdmin(user: User | null): boolean {
	return hasRole(user, Role.CLUB_ADMIN);
}

/** A user with no elevated roles. */
export function isRegularUser(user: User | null): boolean {
	return hasRole(user, Role.USER) && !isClubAdmin(user) && !isAdmin(user);
}

export function logOut(): void {
	clearToken();
}
