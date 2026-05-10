"use client";

import { useState } from "react";
import { sendVerificationCode } from "@/app/lib/user";

export default function EmailForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await sendVerificationCode(email);
      onSubmit(email);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="email"
        placeholder="Email"
        className="w-full border rounded px-4 py-2 mb-4"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        disabled={loading}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <button
        className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Sending..." : "Continue"}
      </button>
    </form>
  );
}

