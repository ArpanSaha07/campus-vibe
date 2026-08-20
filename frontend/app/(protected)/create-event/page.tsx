import CreateEventForm from "@/app/components/event/CreateEventForm";

// Sign-in is already enforced by (protected)/layout.tsx, which also supplies the
// navbar and footer. Authority is checked twice more below it: the form offers
// only clubs this user manages, and the backend re-checks canManageClub on the
// organiser it is given.
//
// The commented-out getCurrentUser redirect that used to live here has gone
// with the rest of the placeholder form -- it referenced a module that does not
// exist in this project.
export default function CreateEventPage() {
  return <CreateEventForm />;
}
