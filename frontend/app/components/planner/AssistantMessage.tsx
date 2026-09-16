import Link from "next/link";
import { RotateCcw, Sparkles } from "lucide-react";
import ClubCard from "@/app/components/club/ClubCard";
import EventCard from "@/app/components/event/EventCard";
import CardRow from "@/app/components/planner/CardRow";
import { formatEventWeekday } from "@/app/lib/event-zone";
import { FOLLOW_UPS, pickRowLabel } from "@/app/lib/planner";
import type { PlannerMessage, PlannerPick } from "@/app/types";

/**
 * One planner answer, in the order the design fixes: the intro, one row of
 * cards, a line per pick saying why it fits, then follow-up prompts. An
 * answer's picks are all events or all clubs, so there is never a second row.
 */
export default function AssistantMessage({
  message,
  onFollowUp,
  onRetry,
  followUpsDisabled = false,
}: {
  message: PlannerMessage;
  onFollowUp: (prompt: string) => void;
  /** Offered only on a failed reply that can be sent again. */
  onRetry?: () => void;
  followUpsDisabled?: boolean;
}) {
  const { picks, status } = message;
  const kind = picks[0]?.kind;
  const thinking = status === "streaming" && !message.content;

  return (
    <article aria-label="Planner answer" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
          <Sparkles className="h-3 w-3" aria-hidden="true" />
        </span>
        <span className="text-sm font-semibold text-ink-900">CampusVibe planner</span>
      </div>

      {thinking ? (
        <p role="status" className="text-[15px] text-ink-600 motion-safe:animate-pulse">
          Looking through what&apos;s coming up…
        </p>
      ) : (
        message.content && (
          <p className="max-w-[720px] whitespace-pre-wrap text-[15px] leading-relaxed text-ink-900">
            {message.content}
          </p>
        )
      )}

      {kind && (
        <>
          <p className="ticket-label mt-2 text-ink-600">{pickRowLabel(picks)}</p>
          <CardRow label={kind === "event" ? "Recommended events" : "Recommended clubs"}>
            {picks.map((pick) => (
              <div role="listitem" key={pickKey(pick)} className="flex-shrink-0">
                {pick.kind === "event" ? <EventCard event={pick.event} /> : <ClubCard club={pick.club} />}
              </div>
            ))}
          </CardRow>

          <ul className="mt-2 flex max-w-[720px] flex-col gap-3">
            {picks.map((pick) => (
              <li key={pickKey(pick)} className="flex gap-3 text-[15px] leading-relaxed text-ink-900">
                {pick.kind === "event" && (
                  <span className="ticket-label w-9 flex-shrink-0 pt-[3px] text-ink-600">
                    {formatEventWeekday(pick.event.dateTime)}
                  </span>
                )}
                <p>
                  <Link
                    href={pick.kind === "event" ? `/events/${pick.event.eventId}` : `/clubs/${pick.club.clubId}`}
                    className="font-semibold text-lavender-600 hover:text-lavender-800"
                  >
                    {pick.kind === "event" ? pick.event.title : pick.club.name}
                  </Link>{" "}
                  {pick.reason}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}

      {status === "failed" && (
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-alert-600">{message.error}</p>
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-lavender-600 hover:bg-lavender-50 hover:text-lavender-800"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {status === "stopped" && <p className="ticket-label text-ink-600">Stopped</p>}

      {status === "complete" && kind && (
        <ul aria-label="Follow-up prompts" className="mt-2 flex flex-wrap gap-2">
          {FOLLOW_UPS[kind].map((prompt) => (
            <li key={prompt}>
              <button
                type="button"
                onClick={() => onFollowUp(prompt)}
                disabled={followUpsDisabled}
                className="inline-flex items-center gap-1.5 rounded-full bg-lavender-100 px-4 py-2 text-xs font-semibold text-lavender-800 transition-colors hover:bg-lavender-200 disabled:pointer-events-none disabled:opacity-50"
              >
                <Sparkles className="h-3 w-3" aria-hidden="true" />
                {prompt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

function pickKey(pick: PlannerPick): string {
  return pick.kind === "event" ? `event-${pick.event.eventId}` : `club-${pick.club.clubId}`;
}
