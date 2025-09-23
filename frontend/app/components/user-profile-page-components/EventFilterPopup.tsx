"use client";

export default function EventFilterPopup({
  currentFilter,
  onSelect,
  onClose,
}: {
  currentFilter: "upcoming" | "past" | "all";
  onSelect: (f: "upcoming" | "past" | "all") => void;
  onClose: () => void;
}) {
  const filters = ["upcoming", "past", "all"] as const;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <div className="bg-white p-6 rounded-lg shadow-lg w-64">
        <h2 className="text-lg font-bold mb-4">Filter Events</h2>
        <ul className="space-y-2">
          {filters.map(f => (
            <li key={f}>
              <button
                onClick={() => {
                  onSelect(f);
                  onClose();
                }}
                className={`w-full text-left px-4 py-2 rounded ${
                  currentFilter === f ? "bg-blue-100 font-semibold" : ""
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)} events
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={onClose}
          className="mt-4 w-full bg-gray-200 rounded py-2"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}