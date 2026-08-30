"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import type { CurrentUser, ScheduledEmailRow, SearchHit, SentEmailRow } from "@/lib/types";
import { Sidebar, type NavKey } from "@/components/Sidebar";
import { TopSearchBar } from "@/components/TopSearchBar";
import { EmailList, type ListRowData } from "@/components/EmailList";
import { ComposeView } from "@/components/ComposeView";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [slackConnected, setSlackConnected] = useState(false);
  const [nav, setNav] = useState<NavKey>("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmailRow[]>([]);
  const [sent, setSent] = useState<SentEmailRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [searchHits, setSearchHits] = useState<SearchHit[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [s, sn] = await Promise.all([api.scheduledEmails(), api.sentEmails()]);
      setScheduled(s);
      setSent(sn);
    } catch {
      // empty state covers this
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    api
      .me()
      .then((u) => setUser(u))
      .catch(() => router.replace("/"))
      .finally(() => setAuthChecked(true));

    api
      .slackStatus()
      .then((s) => setSlackConnected(s.connected))
      .catch(() => setSlackConnected(false));
  }, [router]);

  useEffect(() => {
    if (!authChecked || !user) return;
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, [authChecked, user, loadData]);

  if (!authChecked) return null;

  const scheduledRows: ListRowData[] = scheduled.map((r) => ({
    id: r.id,
    recipientEmail: r.recipient_email,
    subject: r.subject,
    body: r.body,
    status: r.status,
    time: r.scheduled_time,
  }));

  const sentRows: ListRowData[] = sent.map((r) => ({
    id: r.id,
    recipientEmail: r.recipient_email,
    subject: r.subject,
    body: r.body,
    status: r.status,
    time: r.sent_at,
  }));

  return (
    <div className="h-screen flex">
      <Sidebar
        user={user}
        activeNav={nav}
        counts={{ scheduled: scheduled.length, sent: sent.length }}
        slackConnected={slackConnected}
        onNavChange={(n) => {
          setNav(n);
          setComposing(false);
        }}
        onCompose={() => setComposing(true)}
        onLogout={() => api.logout().then(() => router.replace("/"))}
      />

      <main className="flex-1 flex flex-col min-w-0">
        {composing ? (
          <ComposeView onBack={() => setComposing(false)} onScheduled={loadData} />
        ) : (
          <>
            <TopSearchBar
              onResults={(hits, q) => {
                setSearchHits(hits);
                setSearchQuery(q);
              }}
              onClear={() => {
                setSearchHits(null);
                setSearchQuery("");
              }}
              onRefresh={loadData}
            />

            <div className="flex-1 overflow-y-auto">
              {searchHits !== null ? (
                <>
                  <div className="px-5 py-3 text-xs text-text-dim border-b border-border-soft">
                    {searchHits.length} result{searchHits.length === 1 ? "" : "s"} for &ldquo;{searchQuery}&rdquo;
                  </div>
                  <EmailList
                    rows={searchHits.map((h) => ({
                      id: h.id,
                      recipientEmail: h.recipientEmail,
                      subject: h.subject,
                      body: h.body,
                      status: h.status,
                      time: h.sentAt || h.scheduledTime,
                    }))}
                    loading={false}
                    emptyTitle="No matches"
                    emptyHint="Try a different subject, sender, or keyword."
                  />
                </>
              ) : nav === "scheduled" ? (
                <EmailList
                  rows={scheduledRows}
                  loading={loading}
                  emptyTitle="Nothing in the queue"
                  emptyHint="Compose a new email to schedule your first send."
                />
              ) : (
                <EmailList
                  rows={sentRows}
                  loading={loading}
                  emptyTitle="No sends yet"
                  emptyHint="Emails will show up here once the scheduler dispatches them."
                />
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
