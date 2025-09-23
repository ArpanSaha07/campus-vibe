"use client";

import { useState } from "react";
import EmailForm from "@/app/components/auth-components/EmailForm";
import CodeForm from "@/app/components/auth-components/CodeForm";
import OAuthButtons from "@/app/components/auth-components/OAuthButtons";
import AuthCard from "@/app/components/auth-components/AuthCard";


// TODO: remove navbar and footer from auth pages

export default function LoginPage() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 
      lg:bg-[url('/frosh1.jpeg')] bg-cover bg-center">
      <AuthCard>
        {step === "email" && (
          <EmailForm
            onSubmit={(userEmail) => {
              setEmail(userEmail);
              setStep("code");
            }}
          />
        )}
        {step === "code" && (
          <CodeForm email={email} onBack={() => setStep("email")} />
        )}
        <div className="mt-6">
          <OAuthButtons />
        </div>
      </AuthCard>
    </div>
  );
}
