import type { Metadata } from "next";
import PlannerChat from "@/app/components/planner/PlannerChat";

export const metadata: Metadata = {
  title: "Plan with CampusVibe",
  description: "Ask for campus events, clubs, or a whole weekend, planned around your interests.",
};

// One saved chat. Its messages are per-user, so they are fetched in the
// browser with the user's token and never rendered or cached on the server.
export default async function PlannerConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  return <PlannerChat key={conversationId} conversationId={conversationId} />;
}
