"use client";

import { useState } from "react";

export default function CodeForm({ email, onBack }: { email: string, onBack: () => void }) {
  const [code, setCode] = useState("");

  function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    // Call backend API to verify code here
    console.log("Verifying", code);
  }

  return (
    <form onSubmit={handleVerify}>
      <h1 className="text-2xl font-bold mb-2">Check your email</h1>
      <p className="mb-4">We sent a code to {email}</p>
      <input
        type="text"
        placeholder="Enter code"
        className="w-full border rounded px-4 py-2 mb-4"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        required
      />
      <button className="w-full bg-orange-500 text-white py-2 rounded hover:bg-orange-600">
        Verify
      </button>
      <button type="button" onClick={onBack} className="mt-2 text-sm text-gray-600">
        Back
      </button>
    </form>
  );
}
