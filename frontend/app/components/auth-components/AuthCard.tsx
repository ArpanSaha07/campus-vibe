import Image from "next/image";

export default function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white w-full max-w-md p-6">
        <Image src="/campus-vibe-logo.png" alt="CampusVibe Logo" width={120} height={50} className="mb-10" />
        {children}
    </div>
  );
}
