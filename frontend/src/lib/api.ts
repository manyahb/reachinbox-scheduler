import type {
  CurrentUser,
  ScheduledEmailRow,
  ScheduleResponse,
  SearchHit,
  SentEmailRow,
} from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  me: () => request<CurrentUser>("/api/auth/me"),
  logout: () => request<{ ok: true }>("/api/auth/logout", { method: "POST" }),

  slackStatus: () =>
    request<{ connected: boolean; team_name?: string }>("/api/slack/status"),
  slackDisconnect: () =>
    request<{ ok: true }>("/api/slack/disconnect", { method: "DELETE" }),

  scheduledEmails: () => request<ScheduledEmailRow[]>("/api/emails/scheduled"),
  sentEmails: () => request<SentEmailRow[]>("/api/emails/sent"),

  schedule: (formData: FormData) =>
    request<ScheduleResponse>("/api/schedule", {
      method: "POST",
      body: formData,
    }),

  searchEmails: (q: string) =>
    request<SearchHit[]>(`/api/emails/search?q=${encodeURIComponent(q)}`),
};

export function googleLoginUrl(): string {
  return `${API_URL}/api/auth/google`;
}

export function slackConnectUrl(): string {
  return `${API_URL}/api/slack/oauth/start`;
}
