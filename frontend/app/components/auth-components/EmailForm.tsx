"use client";

import { useState } from "react";
import { login, register } from "@/app/lib/user";

export default function EmailForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Simplified dev flow: try login, if fails, register, then go to next step
    try {
      await login(email, "password");
      onSubmit(email);
    } catch {
      await register(email.split("@")[0], email, "password");
      onSubmit(email);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-4xl font-bold mb-2">Welcome!</h1>
      <p className="text-4xl font-bold mb-10">What&apos;s your email?</p>
      <input
        type="email"
        placeholder="Email"
        className="w-full border rounded px-4 py-2 mb-8"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <button className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600">
        Continue
      </button>
    </form>
  );
}
