"use client";

import { Pencil } from "lucide-react";
import { useAuth } from "@/app/lib/auth-context";
import { useManagedClubs } from "@/app/lib/managed-clubs-context";
import { isAdmin } from "@/app/lib/user";
import Button from "@/app/components/ui/Button";

/**
 * An Edit link on the public event page, for the people who run its club.
 *
 * <strong>Visibility only</strong>, like `ManageClubPill`: the edit page and
 * `PUT /events/{id}` both re-derive authority from the database. A client
 * component inside the server-rendered page, so the page itself stays a Server
 * Component and cacheable for everyone else.
 *
 * Renders nothing at all for anyone who cannot use it.
 */
export default function ManageEventLink({
  eventId,
  clubId,
}: {
  eventId: string;
  clubId: string;
}) {
  const { user } = useAuth();
  const { roleIn } = useManagedClubs();

  const mayManage = (user != null && isAdmin(user)) || roleIn(clubId) !== null;
  if (!mayManage) return null;

  return (
    <Button href={`/manage/${clubId}/events/${eventId}/edit`} variant="secondary">
      <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
      Edit event
    </Button>
  );
}
