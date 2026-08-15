import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Shown when page.tsx calls notFound() for an id no event has — including an id
 * that is not a number at all, which cannot name an event and is answered
 * without a request.
 *
 * Scoped to this segment rather than falling back to the root 404 so it keeps
 * (main)'s navbar and footer and can offer somewhere to go next.
 */
export default function EventNotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <EmptyState
        title="Event not found"
        body="This event doesn't exist — it may have been cancelled or removed."
        action={
          <Button href="/events" variant="secondary">
            Browse all events
          </Button>
        }
      />
    </div>
  );
}
