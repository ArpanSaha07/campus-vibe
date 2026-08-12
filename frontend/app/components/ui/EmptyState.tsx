import type { ReactNode } from "react";

export default function EmptyState({
  title,
  body,
  action,
  icon,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-mist-200 bg-mist-100/60 px-8 py-14 text-center">
      {icon && (
        <div className="mb-5 flex justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender-100 text-lavender-600">
            {icon}
          </span>
        </div>
      )}
      <h3 className="font-display text-xl font-bold text-ink-900">{title}</h3>
      {body && <p className="text-sm text-ink-600 mt-2 max-w-md mx-auto">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}
