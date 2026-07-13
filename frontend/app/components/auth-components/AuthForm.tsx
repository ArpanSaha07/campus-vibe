"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/lib/auth-context";

type Mode = "login" | "register";

export default function AuthForm() {
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "login") {
        await login(email, password);
      } else {
        await register(name, email, password);
      }
      router.push("/");
    } catch (err) {
      setError(parseApiError(err, mode));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold mb-4">
        {mode === "login" ? "Log in" : "Create your account"}
      </h1>
      {mode === "register" && (
        <input
          type="text"
          placeholder="Full name"
          className="w-full border rounded px-4 py-2 mb-4"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
        />
      )}
      <input
        type="email"
        placeholder="Email"
        className="w-full border rounded px-4 py-2 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      <input
        type="password"
        placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
        className="w-full border rounded px-4 py-2 mb-4"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={mode === "register" ? 8 : undefined}
        required
        disabled={loading}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <button
        className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        disabled={loading}
      >
        {loading
          ? mode === "login" ? "Logging in..." : "Creating account..."
          : mode === "login" ? "Log in" : "Sign up"}
      </button>
      <button
        type="button"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setError("");
        }}
        className="mt-3 w-full text-sm text-gray-600 hover:text-gray-800"
        disabled={loading}
      >
        {mode === "login"
          ? "New here? Create an account"
          : "Already have an account? Log in"}
      </button>
    </form>
  );
}

// Backend errors arrive as an ApiError JSON string in Error.message
function parseApiError(err: unknown, mode: Mode): string {
  const fallback = mode === "login" ? "Login failed" : "Registration failed";
  if (!(err instanceof Error) || !err.message) return fallback;
  try {
    const parsed = JSON.parse(err.message);
    return parsed.message || fallback;
  } catch {
    return err.message;
  }
}
