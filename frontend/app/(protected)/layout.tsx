import type { ReactNode } from "react";
import Navbar from "@/app/components/Navbar";
import Footer from "@/app/components/Footer";
import { ProtectedRoute } from "@/app/components/ProtectedRoute";

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col">
        <ProtectedRoute>{children}</ProtectedRoute>
      </div>
      <Footer />
    </div>
  );
}
