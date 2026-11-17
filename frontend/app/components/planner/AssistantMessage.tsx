import Link from "next/link";
import { Check, Minus, RotateCcw, Sparkles } from "lucide-react";
import ClubCard from "@/app/components/club/ClubCard";
import AddToCalendarLink from "@/app/components/event/AddToCalendarLink";
import EventCard from "@/app/components/event/EventCard";
import CardRow from "@/app/components/planner/CardRow";
import { formatEventWeekday } from "@/app/lib/event-zone";
import { FOLLOW_UPS, actionSentence, pickRowLabel } from "@/app/lib/planner";
import type { PlannerAction, PlannerMessage, PlannerPick } from "@/app/types";

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
  const actions = message.actions ?? [];
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
          {message.activity ?? "Looking through what’s coming up…"}
        </p>
      ) : (
        message.content && (
          <p className="max-w-[720px] whitespace-pre-wrap text-[15px] leading-relaxed text-ink-900">
            {message.content}
          </p>
        )
      )}

      {actions.length > 0 && (
        <ul aria-label="What the planner did" className="flex max-w-[720px] flex-col gap-2">
          {actions.map((action, index) => (
            <ActionLine key={`${action.type}-${action.id}-${index}`} action={action} />
          ))}
        </ul>
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

/**
 * One action the agent took (ADR-023). A change to the account reads with a
 * check; one that changed nothing reads muted. An offered calendar link is the
 * existing template link: the student's click is the confirmation.
 */
function ActionLine({ action }: { action: PlannerAction }) {
  const changed = action.outcome === "done";
  const sentence = actionSentence(action);

  if (action.type === "calendar" && action.event) {
    return (
      <li className="flex items-center gap-2 text-sm text-ink-900">
        <AddToCalendarLink event={action.event} />
        <span className="text-ink-600">{action.name}</span>
      </li>
    );
  }

  const href =
    changed && action.targetKind === "club"
      ? `/clubs/${encodeURIComponent(action.id)}`
      : changed
        ? `/events/${encodeURIComponent(action.id)}`
        : null;
  return (
    <li className={`flex items-center gap-2 text-sm ${changed ? "text-ink-900" : "text-ink-600"}`}>
      {changed ? (
        <Check className="h-3.5 w-3.5 flex-shrink-0 text-lavender-600" aria-hidden="true" />
      ) : (
        <Minus className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      )}
      {href ? (
        <Link href={href} className="hover:text-lavender-800">
          {sentence}
        </Link>
      ) : (
        <span>{sentence}</span>
      )}
    </li>
  );
}

function pickKey(pick: PlannerPick): string {
  return pick.kind === "event" ? `event-${pick.event.eventId}` : `club-${pick.club.clubId}`;
}
