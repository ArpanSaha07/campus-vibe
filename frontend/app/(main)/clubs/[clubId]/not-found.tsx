import EmptyState from "@/app/components/ui/EmptyState";
import Button from "@/app/components/ui/Button";

/**
 * Shown when `page.tsx` calls notFound() for a slug no club has.
 *
 * Deliberately the same card the page used to render inline, so nothing about
 * the screen changes — what changes is the response carrying it, which is now a
 * real 404 with Next's noindex tag rather than a 200 that looks fine to a
 * crawler. Scoped to this segment rather than using the root not-found page so
 * it keeps (main)'s navbar and footer and can offer a way onward.
 */
export default function ClubNotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-16">
      <EmptyState
        title="Club not found"
        body="This club page doesn't exist — it may have been renamed or removed."
        action={
          <Button href="/clubs" variant="secondary">
            Browse all clubs
          </Button>
        }
      />
    </div>
  );
}
