export default function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="min-h-28 rounded-2xl border border-mist-200 bg-white p-5 lift">
      <p className="ticket-label text-ink-600">{label}</p>
      <p className="font-display text-3xl font-bold text-ink-900 mt-2">{value}</p>
      {hint && <p className="text-xs text-ink-600 mt-1">{hint}</p>}
    </div>
  );
}
