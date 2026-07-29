"use client";

import AuthForm from "@/app/components/auth-components/AuthForm";
import OAuthButtons from "@/app/components/auth-components/OAuthButtons";
import AuthCard from "@/app/components/auth-components/AuthCard";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-300
      bg-[url('/frosh1.jpeg')] bg-cover bg-center">
      <AuthCard>
        <AuthForm />
        <div className="mt-6">
          <OAuthButtons />
        </div>
      </AuthCard>
    </div>
  );
}
