"use client";

import type { CurrentUser } from "@/lib/types";
import { slackConnectUrl, api } from "@/lib/api";

export type NavKey = "scheduled" | "sent";

export function Sidebar({
  user,
  activeNav,
  counts,
  slackConnected,
  onNavChange,
  onCompose,
  onLogout,
}: {
  user: CurrentUser | null;
  activeNav: NavKey;
  counts: { scheduled: number; sent: number };
  slackConnected: boolean;
  onNavChange: (nav: NavKey) => void;
  onCompose: () => void;
  onLogout: () => void;
}) {
  return (
    <aside className="w-[260px] shrink-0 h-full border-r border-border flex flex-col py-5 px-3">
      <div className="px-2 mb-6 flex items-center gap-2">
        <div className="h-7 w-7 rounded-md bg-green flex items-center justify-center">
          <span className="text-white font-display text-sm font-bold">D</span>
        </div>
        <span className="font-display text-lg font-bold tracking-tight text-text">Dispatch</span>
      </div>

      {user && (
        <div className="px-2 mb-4 flex items-center gap-2.5">
          {user.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar_url} alt="" className="h-9 w-9 rounded-full border border-border" />
          ) : (
            <div className="h-9 w-9 rounded-full bg-surface-hover border border-border flex items-center justify-center text-sm font-medium text-text-muted">
              {user.name?.[0] ?? "U"}
            </div>
          )}
          <div className="min-w-0">
            <div className="text-sm font-medium text-text truncate leading-tight">{user.name}</div>
            <div className="text-xs text-text-dim truncate leading-tight">{user.email}</div>
          </div>
        </div>
      )}

      <button
        onClick={onCompose}
        className="mx-2 mb-5 rounded-full border border-green text-green-dark font-medium text-sm py-2 hover:bg-green-soft-bg transition-colors"
      >
        Compose
      </button>

      <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-dim">
        Core
      </div>

      <nav className="flex flex-col gap-0.5 px-1">
        <NavItem
          icon="clock"
          label="Scheduled"
          count={counts.scheduled}
          active={activeNav === "scheduled"}
          onClick={() => onNavChange("scheduled")}
        />
        <NavItem
          icon="send"
          label="Sent"
          count={counts.sent}
          active={activeNav === "sent"}
          onClick={() => onNavChange("sent")}
        />
      </nav>

      <div className="mt-auto px-2 pt-4 border-t border-border-soft flex flex-col gap-2">
        <button
          onClick={() => {
            if (slackConnected) {
              api.slackDisconnect().then(() => window.location.reload());
            } else {
              window.location.href = slackConnectUrl();
            }
          }}
          className={`text-xs font-medium text-left px-2 py-1.5 rounded-md transition-colors ${
            slackConnected
              ? "text-green-soft-text bg-green-soft-bg"
              : "text-text-muted hover:bg-surface-hover"
          }`}
        >
          {slackConnected ? "● Slack connected" : "Connect Slack"}
        </button>
        <button
          onClick={onLogout}
          className="text-xs font-medium text-left px-2 py-1.5 rounded-md text-text-dim hover:text-coral-soft-text hover:bg-surface-hover transition-colors"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}

function NavItem({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: "clock" | "send";
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors ${
        active ? "bg-green-soft-bg text-green-soft-text font-medium" : "text-text-muted hover:bg-surface-hover"
      }`}
    >
      <span className="flex items-center gap-2.5">
        <Icon name={icon} className="h-4 w-4" />
        {label}
      </span>
      <span className="text-xs font-mono text-text-dim">{count}</span>
    </button>
  );
}

function Icon({ name, className }: { name: "clock" | "send" | "search" | "filter" | "refresh" | "star" | "starFilled"; className?: string }) {
  switch (name) {
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" />
        </svg>
      );
    case "send":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M22 2 11 13" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22 2 15 22l-4-9-9-4 20-7Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
      );
    case "filter":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M4 5h16M7 12h10M10 19h4" strokeLinecap="round" />
        </svg>
      );
    case "refresh":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
          <path d="M3 12a9 9 0 0 1 15.3-6.5L21 8M21 3v5h-5" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12a9 9 0 0 1-15.3 6.5L3 16M3 21v-5h5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} className={className}>
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1L12 2Z" />
        </svg>
      );
    case "starFilled":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
          <path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.9-6.2-3.3-6.2 3.3 1.2-6.9-5-4.9 6.9-1L12 2Z" />
        </svg>
      );
  }
}

export { Icon };
