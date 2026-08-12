import type { Metadata } from "next";
import PlannerClient from "@/app/components/planner/PlannerClient";
import type { PlannerPageProps } from "@/app/types";

export const metadata: Metadata = {
  title: "Plan with CampusVibe",
  description: "A personalized plan of campus events and clubs, built from your prompt.",
};

// The prompt arrives as ?prompt=… from the homepage planner card. Once planner
// sessions exist on the backend this becomes /planner/results/{id}.
export default async function PlannerPage({ searchParams }: PlannerPageProps) {
  const { prompt } = await searchParams;
  const initialPrompt = (Array.isArray(prompt) ? prompt[0] : prompt) ?? "";

  return <PlannerClient initialPrompt={initialPrompt} />;
}
