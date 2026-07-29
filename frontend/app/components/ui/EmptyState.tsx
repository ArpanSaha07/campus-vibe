import type { ReactNode } from "react";

export default function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-mist-200 bg-mist-100/60 px-8 py-14 text-center">
      <h3 className="font-display text-xl font-bold text-ink-900">{title}</h3>
      {body && <p className="text-sm text-ink-600 mt-2 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
