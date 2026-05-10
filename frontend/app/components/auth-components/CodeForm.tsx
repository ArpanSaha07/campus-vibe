"use client";

import { useState } from "react";
import { verifyCode } from "@/app/lib/user";

export default function CodeForm({ email, onBack }: { email: string; onBack: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await verifyCode(email, code);
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid code");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleVerify}>
      <h1 className="text-2xl font-bold mb-2">Check your email</h1>
      <p className="text-gray-600 mb-4">We sent a code to {email}</p>
      <input
        type="text"
        placeholder="Enter 6-digit code"
        className="w-full border rounded px-4 py-2 mb-4"
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        maxLength={6}
        required
        disabled={loading}
      />
      {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
      <button
        className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600 disabled:opacity-50"
        disabled={loading}
      >
        {loading ? "Verifying..." : "Verify"}
      </button>
      <button
        type="button"
        onClick={onBack}
        className="mt-2 w-full text-sm text-gray-600 hover:text-gray-800"
        disabled={loading}
      >
        Back
      </button>
    </form>
  );
}

