import type { ReactNode } from "react";
import { Info, Sparkles } from "lucide-react";
import Chip from "@/app/components/ui/Chip";
import { MAX_CONVERSATIONS, PLANNER_SUGGESTIONS } from "@/app/lib/planner";

/**
 * A new chat: what the planner does, the message box, and starting prompts.
 * At the chat cap it names the chat that sending will delete, before anything
 * is deleted: the server removes it only when the first message goes out.
 */
export default function PlannerEmptyState({
  evictTitle,
  composer,
  notice,
  onSuggestion,
}: {
  /** The least recently active chat, when 15 are saved; null otherwise. */
  evictTitle: string | null;
  composer: ReactNode;
  /** A sign-in prompt or a failed start, shown under the message box. */
  notice?: ReactNode;
  onSuggestion: (prompt: string) => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col items-center gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="font-display flex items-center gap-3 text-3xl font-bold leading-tight text-ink-900 sm:text-[40px]">
          Plan with CampusVibe
          <Sparkles className="hidden h-7 w-7 sm:block" aria-hidden="true" />
        </h1>
        <p className="max-w-[560px] text-[15px] leading-relaxed text-ink-600">
          Ask for events, clubs, or a whole weekend. Answers use your interests, your saved events
          and the clubs you follow, and only include events that haven&apos;t ended.
        </p>
      </div>

      {evictTitle !== null && (
        <div
          role="note"
          className="flex w-full items-start gap-3 rounded-xl border border-lavender-200 bg-lavender-50 px-4 py-3"
        >
          <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-lavender-600" aria-hidden="true" />
          <p className="text-sm leading-normal text-ink-900">
            You have {MAX_CONVERSATIONS} saved chats, the most you can keep. Sending your first message here deletes
            your oldest chat, <span className="font-semibold">{evictTitle}</span>.
          </p>
        </div>
      )}

      <div className="w-full">{composer}</div>

      {notice}

      <ul className="flex flex-wrap justify-center gap-2">
        {PLANNER_SUGGESTIONS.map((suggestion) => (
          <li key={suggestion.label}>
            <Chip onClick={() => onSuggestion(suggestion.prompt)}>{suggestion.label}</Chip>
          </li>
        ))}
      </ul>
    </div>
  );
}
