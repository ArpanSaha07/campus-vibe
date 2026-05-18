import { apiFetch, setToken } from "./api";
import type { User, Admin, ClubAdmin, RegularUser } from "@/app/types";

type AuthResponse = { token: string; user: User };

export async function sendVerificationCode(email: string): Promise<void> {
	await apiFetch(`/api/v1/auth/send-code`, {
		method: "POST",
		body: JSON.stringify({ email }),
	});
}

export async function verifyCode(email: string, code: string): Promise<User> {
	const res = await apiFetch<AuthResponse>(`/api/v1/auth/verify-code`, {
		method: "POST",
		body: JSON.stringify({ email, code }),
	});
	setToken(res.token);
	return res.user;
}

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

export async function me(): Promise<Admin | ClubAdmin | RegularUser> {
  return (await apiFetch(`/api/v1/users/me`, { auth: true })) as Admin | ClubAdmin | RegularUser;
}

export function isRegularUser(user: User): boolean {
	return user.role === 'regularUser';
}

export async function logOut(): Promise<void> {
	setToken("");
}
