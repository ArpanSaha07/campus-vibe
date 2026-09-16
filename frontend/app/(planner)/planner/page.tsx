import type { Metadata } from "next";
import PlannerChat from "@/app/components/planner/PlannerChat";
import type { PlannerPageProps } from "@/app/types";

export const metadata: Metadata = {
  title: "Plan with CampusVibe",
  description: "Ask for campus events, clubs, or a whole weekend, planned around your interests.",
};

// A new chat. The homepage card arrives with ?prompt=…, which is sent as the
// first message once the planner is ready.
export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const { prompt } = await searchParams;
  const initialPrompt = (Array.isArray(prompt) ? prompt[0] : prompt) ?? "";

  return <PlannerChat conversationId={null} initialPrompt={initialPrompt} />;
}
