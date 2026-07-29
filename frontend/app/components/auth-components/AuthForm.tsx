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
      <h1 className="font-display text-2xl font-bold text-ink-900 mb-4">
        {mode === "login" ? "Log in" : "Create your account"}
      </h1>
      {mode === "register" && (
        <input
          type="text"
          placeholder="Full name"
          className="w-full rounded-xl bg-mist-100 border border-transparent px-4 py-2.5 mb-4 text-ink-900 placeholder-ink-600 focus:bg-white focus:border-lavender-300 outline-none transition-colors"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          disabled={loading}
        />
      )}
      <input
        type="email"
        placeholder="Email"
        className="w-full rounded-xl bg-mist-100 border border-transparent px-4 py-2.5 mb-4 text-ink-900 placeholder-ink-600 focus:bg-white focus:border-lavender-300 outline-none transition-colors"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      <input
        type="password"
        placeholder={mode === "register" ? "Password (min 8 characters)" : "Password"}
        className="w-full rounded-xl bg-mist-100 border border-transparent px-4 py-2.5 mb-4 text-ink-900 placeholder-ink-600 focus:bg-white focus:border-lavender-300 outline-none transition-colors"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={mode === "register" ? 8 : undefined}
        required
        disabled={loading}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <button
        className="w-full h-11 bg-lavender-600 text-white font-semibold rounded-full hover:bg-lavender-800 active:scale-[0.98] transition disabled:opacity-50"
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
        className="mt-3 w-full text-sm font-semibold text-lavender-600 hover:text-lavender-800"
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
