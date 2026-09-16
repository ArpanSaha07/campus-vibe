import type { ReactNode } from "react";
import Navbar from "@/app/components/Navbar";
import { PlannerProvider } from "@/app/components/planner/PlannerProvider";
import PlannerShell from "@/app/components/planner/PlannerShell";

// The planner fills the viewport like a chat app: navbar, then the chat list
// and the conversation, each scrolling on its own. No footer, which would sit
// under a page that never scrolls. The provider is here, not in the pages,
// because a layout survives the move from /planner to /planner/{id}.
export default function PlannerLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <Navbar />
      <PlannerProvider>
        <PlannerShell>{children}</PlannerShell>
      </PlannerProvider>
    </div>
  );
}
