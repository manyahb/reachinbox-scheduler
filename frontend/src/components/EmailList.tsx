"use client";

import { useState } from "react";
import type { EmailStatus } from "@/lib/types";
import { StatusBadge } from "./StatusBadge";
import { Icon } from "./Sidebar";

export interface ListRowData {
  id: number;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  time: string | null; // scheduled_time or sent_at
}

function displayNameFromEmail(email: string): string {
  const local = email.split("@")[0] || email;
  return local
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EmailRow({ row }: { row: ListRowData }) {
  const [starred, setStarred] = useState(false);
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-border-soft last:border-0 hover:bg-surface-hover transition-colors group">
      <button
        onClick={() => setStarred((s) => !s)}
        className="text-text-dim hover:text-amber-soft-text transition-colors shrink-0"
        aria-label="star"
      >
        <Icon name={starred ? "starFilled" : "star"} className={`h-4 w-4 ${starred ? "text-amber-soft-text" : ""}`} />
      </button>

      <div className="w-40 shrink-0 text-sm text-text truncate">
        To: <span className="font-medium">{displayNameFromEmail(row.recipientEmail)}</span>
      </div>

      {row.time && <StatusBadge status={row.status} time={row.time} />}
      {!row.time && <StatusBadge status={row.status} />}

      <div className="flex-1 min-w-0 text-sm truncate">
        <span className="font-semibold text-text">{row.subject}</span>
        <span className="text-text-dim"> - {row.body}</span>
      </div>
    </div>
  );
}

export function EmailList({
  rows,
  loading,
  emptyTitle,
  emptyHint,
}: {
  rows: ListRowData[];
  loading: boolean;
  emptyTitle: string;
  emptyHint: string;
}) {
  if (loading) {
    return (
      <div>
        {[0, 1, 2].map((r) => (
          <div key={r} className="flex items-center gap-4 px-5 py-3.5 border-b border-border-soft">
            <div className="h-4 w-4 rounded bg-surface-hover animate-pulse" />
            <div className="h-3 w-32 rounded bg-surface-hover animate-pulse" />
            <div className="h-5 w-20 rounded-full bg-surface-hover animate-pulse" />
            <div className="h-3 flex-1 rounded bg-surface-hover animate-pulse" style={{ maxWidth: `${50 + r * 10}%` }} />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="h-10 w-10 rounded-full border border-dashed border-border flex items-center justify-center mb-3 text-text-dim">
          —
        </div>
        <div className="text-sm font-medium text-text-muted">{emptyTitle}</div>
        <div className="text-xs text-text-dim mt-1 max-w-xs">{emptyHint}</div>
      </div>
    );
  }

  return (
    <div>
      {rows.map((row) => (
        <EmailRow key={row.id} row={row} />
      ))}
    </div>
  );
}
