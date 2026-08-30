"use client";

import { useState } from "react";

function nextDayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const QUICK_OPTIONS = [
  { label: "Tomorrow", getDate: () => nextDayAt(9) },
  { label: "Tomorrow, 10:00 AM", getDate: () => nextDayAt(10) },
  { label: "Tomorrow, 11:00 AM", getDate: () => nextDayAt(11) },
  { label: "Tomorrow, 3:00 PM", getDate: () => nextDayAt(15) },
];

export function SendLaterPopover({
  initialValue,
  onCancel,
  onDone,
}: {
  initialValue: string | null;
  onCancel: () => void;
  onDone: (isoOrLocal: string) => void;
}) {
  const [value, setValue] = useState(initialValue || "");

  return (
    <div className="absolute right-0 top-full mt-2 w-72 rounded-lg border border-border bg-surface shadow-lg z-20 animate-fade-in-up">
      <div className="px-4 pt-4 pb-2 font-semibold text-sm text-text">Send Later</div>

      <div className="px-4 pb-2">
        <label className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-muted">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 shrink-0">
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
          </svg>
          <input
            type="datetime-local"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="flex-1 bg-transparent outline-none text-text"
            placeholder="Pick date & time"
          />
        </label>
      </div>

      <div className="px-2 pb-2 flex flex-col">
        {QUICK_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setValue(toLocalInputValue(opt.getDate()))}
            className="text-left px-3 py-1.5 rounded-md text-sm text-text hover:bg-surface-hover transition-colors"
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-border-soft">
        <button
          onClick={onCancel}
          className="text-sm font-medium text-text-muted px-3 py-1.5 rounded-md hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => value && onDone(value)}
          disabled={!value}
          className="text-sm font-medium text-white bg-green px-4 py-1.5 rounded-md hover:bg-green-dark transition-colors disabled:opacity-50"
        >
          Done
        </button>
      </div>
    </div>
  );
}
