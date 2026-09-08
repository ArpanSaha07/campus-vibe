import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import ProfileEditSidebar from "@/app/components/profile/edit/ProfileEditSidebar";

// Sign-in is already enforced by (protected)/layout.tsx, which also supplies
// the navbar and footer.
//
// A server component: it holds no state, and the rail below is the only part
// that needs the pathname. Keeping the shell on the server means switching
// sections re-renders one panel rather than the page.

export default function ProfileEditLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 lg:px-8 fade-up">
      <Link
        href="/profile"
        className="inline-flex items-center gap-2 text-sm font-semibold text-ink-600 transition-colors hover:text-lavender-600"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to your profile
      </Link>

      <h1 className="mt-4 font-display text-4xl font-bold text-ink-900">Settings</h1>

      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:gap-10">
        <ProfileEditSidebar />
        {/* min-w-0 so a long value inside a panel shrinks the column rather
            than stretching the flex row past the viewport. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
