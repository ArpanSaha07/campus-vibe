"use client";

import { use } from "react";
import ClubEditForm from "@/app/components/manage/ClubEditForm";

/**
 * The Club page section of the dashboard: the club's own editor (CEM-01, CEM-21).
 *
 * Access is already resolved by the layout, and every call the form makes is
 * re-checked by `canManageClub` on the server.
 */
export default function ClubPageSettings({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  return <ClubEditForm clubId={clubId} />;
}
