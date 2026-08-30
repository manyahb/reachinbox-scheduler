import type { EmailStatus } from "@/lib/types";

function formatShortTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const VARIANTS: Record<EmailStatus, { bg: string; text: string; label: string }> = {
  scheduled: { bg: "bg-amber-soft-bg", text: "text-amber-soft-text", label: "Scheduled" },
  processing: { bg: "bg-violet-soft-bg", text: "text-violet-soft-text", label: "Processing" },
  rescheduled: { bg: "bg-violet-soft-bg", text: "text-violet-soft-text", label: "Rescheduled" },
  sent: { bg: "bg-green-soft-bg", text: "text-green-soft-text", label: "Sent" },
  failed: { bg: "bg-coral-soft-bg", text: "text-coral-soft-text", label: "Failed" },
};

export function StatusBadge({ status, time }: { status: EmailStatus; time?: string | null }) {
  const v = VARIANTS[status] ?? VARIANTS.scheduled;
  const showClock = status === "scheduled" || status === "processing" || status === "rescheduled";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${v.bg} ${v.text}`}>
      {showClock && (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-3 w-3">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      )}
      {time ? `${formatShortTime(time)}` : v.label}
    </span>
  );
}
