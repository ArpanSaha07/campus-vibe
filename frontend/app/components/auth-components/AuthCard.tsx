import Image from "next/image";

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white w-full max-w-md p-8 rounded-2xl border border-mist-200 shadow-lift">
      <Image src="/campus-vibe-logo.png" alt="CampusVibe" width={120} height={60} className="mb-8" />
      {children}
    </div>
  );
}
