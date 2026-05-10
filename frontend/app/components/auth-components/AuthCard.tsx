import Image from "next/image";

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white w-full max-w-md p-6">
        <Image src="/campus-vibe-logo.png" alt="CampusVibe Logo" width={120} height={60} className="mb-8" />
        <h1 className="text-4xl font-bold mb-2">Welcome!</h1>
        <p className="text-4xl font-bold mb-10">What&apos;s your email?</p>
        {children}
    </div>
  );
}
