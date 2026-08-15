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

/**
 * Asks for a password-reset link.
 *
 * Resolves the same way whether or not the address has an account — the backend
 * answers 204 either way, on purpose. Do not add error handling that would make
 * the two distinguishable to the user.
 */
export async function requestPasswordReset(email: string): Promise<void> {
	await apiFetch<void>(`/api/v1/auth/forgot-password`, {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

/** Redeems a reset link and sets the new password. Throws if the link is dead. */
export async function resetPassword(token: string, password: string): Promise<void> {
	await apiFetch<void>(`/api/v1/auth/reset-password`, {
		method: "POST",
		body: JSON.stringify({ token, password }),
	});
}

/** Redeems a confirmation link. Throws if the link is dead. */
export async function verifyEmail(token: string): Promise<void> {
	await apiFetch<void>(`/api/v1/auth/verify-email`, {
		method: "POST",
		body: JSON.stringify({ token }),
	});
}

/** Re-sends the confirmation link to the signed-in user. */
export async function resendVerification(): Promise<void> {
	await apiFetch<void>(`/api/v1/auth/resend-verification`, {
		method: "POST",
		auth: true,
	});
}

/** How an account signs in. Mirrors the backend `AuthProvider` enum. */
export type AuthProvider = "LOCAL" | "GOOGLE";

export interface EmailStatus {
	exists: boolean;
	provider: AuthProvider | null;
}

/**
 * Whether an address already has an account, and of which kind.
 *
 * Called by the signup form when the email field loses focus, so that someone
 * who first signed up with Google is told to continue with Google rather than
 * filling in a password and being refused at the end. Deliberately confirms
 * account existence — see AuthenticationService.emailStatus for the trade.
 */
export async function checkEmailStatus(email: string): Promise<EmailStatus> {
	return apiFetch<EmailStatus>(
		`/api/v1/auth/email-status?email=${encodeURIComponent(email)}`
	);
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
