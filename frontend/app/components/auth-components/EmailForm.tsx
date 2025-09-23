"use client";

import { useState } from "react";

export default function EmailForm({ onSubmit }: { onSubmit: (email: string) => void }) {
  const [email, setEmail] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Call backend API to send code here
    onSubmit(email);
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-4xl font-bold mb-2">Welcome!</h1>
      <p className="text-4xl font-bold mb-10">What's your email?</p>
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
