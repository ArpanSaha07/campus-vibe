import { apiFetch, setToken } from "./api";
import type { User } from "@/app/types";

type AuthResponse = { token: string; user: User };

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
