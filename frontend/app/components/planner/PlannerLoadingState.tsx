import { Loader2 } from "lucide-react";

/**
 * Shown between prompt submission and the finished plan. It names the work in
 * progress without claiming any particular retrieval step has finished — there
 * is no real progress to report yet.
 */
export default function PlannerLoadingState() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="rounded-2xl border border-lavender-200 bg-lavender-100 px-6 py-16 text-center"
    >
      <Loader2 className="mx-auto h-8 w-8 animate-spin text-lavender-600" aria-hidden="true" />
      <p className="font-display mt-5 text-xl sm:text-2xl font-bold text-ink-900">
        Creating a plan based on your input and interests
      </p>
      <p className="mt-2 text-sm text-ink-600">This usually takes a few seconds.</p>
    </div>
  );
}
