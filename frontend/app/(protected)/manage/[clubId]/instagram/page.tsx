"use client";

import { use } from "react";
import ClubInstagramPanel from "@/app/components/manage/ClubInstagramPanel";

/**
 * The Instagram section of the dashboard: connect the club's account, turn
 * auto-import on, or import now.
 *
 * Access is already resolved by the layout, and every call the panel makes is
 * re-checked by `canManageClub` on the server.
 */
export default function ClubInstagramSettings({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  return <ClubInstagramPanel clubId={clubId} />;
}
