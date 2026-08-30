"use client";

import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { SendLaterPopover } from "./SendLaterPopover";

function extractEmails(text: string): string[] {
  const matches = text.match(/[^\s,;]+@[^\s,;]+\.[^\s,;]+/g) || [];
  return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
}

export function ComposeView({
  onBack,
  onScheduled,
}: {
  onBack: () => void;
  onScheduled: () => void;
}) {
  const [senderEmail, setSenderEmail] = useState("");
  const [recipients, setRecipients] = useState<string[]>([]);
  const [toInput, setToInput] = useState("");
  const [subject, setSubject] = useState("");
  const [delaySeconds, setDelaySeconds] = useState<number>(0);
  const [hourlyLimit, setHourlyLimit] = useState<number>(0);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [sendLaterValue, setSendLaterValue] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visiblePills = recipients.slice(0, 3);
  const overflowCount = recipients.length - visiblePills.length;

  function handleToKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const emails = extractEmails(toInput);
      if (emails.length) {
        setRecipients((prev) => Array.from(new Set([...prev, ...emails])));
        setToInput("");
      }
    }
  }

  async function handleUploadList(file: File) {
    setUploadedFile(file);
    const text = await file.text();
    setRecipients(extractEmails(text));
  }

  function exec(command: string) {
    document.execCommand(command);
    bodyRef.current?.focus();
  }

  async function handleSubmit() {
    setError(null);
    const bodyText = bodyRef.current?.innerText.trim() || "";

    if (!senderEmail || !subject || !bodyText || recipients.length === 0) {
      setError("From, subject, body, and at least one recipient are required.");
      return;
    }

    setSubmitting(true);
    try {
      const startTime = sendLaterValue ? new Date(sendLaterValue) : new Date();

      // The backend takes a leads file upload. If recipients came from typed
      // chips rather than an uploaded file, build an equivalent in-memory file.
      const leadsFile =
        uploadedFile ?? new File([recipients.join("\n")], "recipients.txt", { type: "text/plain" });

      const fd = new FormData();
      fd.append("subject", subject);
      fd.append("body", bodyText);
      fd.append("senderEmail", senderEmail);
      fd.append("startTime", startTime.toISOString());
      fd.append("delayMs", String(delaySeconds * 1000));
      fd.append("hourlyLimit", String(hourlyLimit || 200));
      fd.append("leadsFile", leadsFile);

      await api.schedule(fd);
      onScheduled();
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to schedule");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={onBack} className="flex items-center gap-2 text-text font-medium text-[15px]">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
            <path d="M19 12H5M12 19l-7-7 7-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          Compose New Email
        </button>

        <div className="flex items-center gap-1 relative">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2 rounded-md text-text-dim hover:bg-surface-hover transition-colors"
            aria-label="attach leads file"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 18.1a2 2 0 0 1-2.83-2.83l8.49-8.49" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.txt"
            className="hidden"
            onChange={(e) => e.target.files && handleUploadList(e.target.files[0])}
          />

          <button
            onClick={() => setPopoverOpen((v) => !v)}
            className="p-2 rounded-md text-text-dim hover:bg-surface-hover transition-colors"
            aria-label="send later"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" strokeLinecap="round" />
            </svg>
          </button>

          {popoverOpen && (
            <SendLaterPopover
              initialValue={sendLaterValue}
              onCancel={() => setPopoverOpen(false)}
              onDone={(v) => {
                setSendLaterValue(v);
                setPopoverOpen(false);
              }}
            />
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="ml-2 rounded-full border border-green text-green-dark font-medium text-sm px-5 py-1.5 hover:bg-green-soft-bg transition-colors disabled:opacity-50"
          >
            {submitting ? "Sending…" : sendLaterValue ? "Schedule" : "Send"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {sendLaterValue && (
          <div className="mb-4 inline-flex items-center gap-2 text-xs font-medium text-green-soft-text bg-green-soft-bg rounded-full px-3 py-1">
            Scheduled for {new Date(sendLaterValue).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            <button onClick={() => setSendLaterValue(null)} className="text-green-soft-text/70 hover:text-green-soft-text">
              ×
            </button>
          </div>
        )}

        <FieldRow label="From">
          <input
            type="email"
            value={senderEmail}
            onChange={(e) => setSenderEmail(e.target.value)}
            placeholder="oliver.brown@domain.io"
            className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim"
          />
        </FieldRow>

        <FieldRow label="To">
          <div className="flex-1 flex flex-wrap items-center gap-1.5">
            {visiblePills.map((email) => (
              <span
                key={email}
                className="inline-flex items-center gap-1 rounded-full bg-green-soft-bg text-green-soft-text text-xs px-2.5 py-1"
              >
                {email}
                <button
                  onClick={() => setRecipients((prev) => prev.filter((e) => e !== email))}
                  className="hover:text-coral-soft-text"
                >
                  ×
                </button>
              </span>
            ))}
            {overflowCount > 0 && (
              <span className="text-xs text-text-dim font-medium">+{overflowCount}</span>
            )}
            <input
              value={toInput}
              onChange={(e) => setToInput(e.target.value)}
              onKeyDown={handleToKeyDown}
              placeholder={recipients.length === 0 ? "recipient@example.com" : "Add another…"}
              className="flex-1 min-w-[140px] bg-transparent outline-none text-sm text-text placeholder:text-text-dim py-0.5"
            />
          </div>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-xs font-medium text-green-soft-text hover:underline shrink-0"
          >
            Upload List
          </button>
        </FieldRow>

        <FieldRow label="Subject">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subject"
            className="flex-1 bg-transparent outline-none text-sm text-text placeholder:text-text-dim"
          />
        </FieldRow>

        <div className="flex items-center gap-8 py-3 border-b border-border-soft">
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Delay between 2 emails (sec)
            <input
              type="number"
              min={0}
              value={delaySeconds}
              onChange={(e) => setDelaySeconds(Number(e.target.value))}
              className="w-16 rounded-md border border-border px-2 py-1 text-sm text-text outline-none focus:border-green"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text-muted">
            Hourly Limit
            <input
              type="number"
              min={0}
              value={hourlyLimit}
              onChange={(e) => setHourlyLimit(Number(e.target.value))}
              className="w-16 rounded-md border border-border px-2 py-1 text-sm text-text outline-none focus:border-green"
            />
          </label>
        </div>

        <div className="flex items-center gap-1 py-2 border-b border-border-soft text-text-dim">
          {[
            { cmd: "bold", label: "B", className: "font-bold" },
            { cmd: "italic", label: "I", className: "italic" },
            { cmd: "underline", label: "U", className: "underline" },
          ].map((btn) => (
            <button
              key={btn.cmd}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(btn.cmd)}
              className={`h-7 w-7 rounded hover:bg-surface-hover text-sm ${btn.className}`}
            >
              {btn.label}
            </button>
          ))}
          <div className="w-px h-4 bg-border mx-1" />
          {[
            { cmd: "insertUnorderedList", icon: "•" },
            { cmd: "insertOrderedList", icon: "1." },
          ].map((btn) => (
            <button
              key={btn.cmd}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec(btn.cmd)}
              className="h-7 w-7 rounded hover:bg-surface-hover text-xs"
            >
              {btn.icon}
            </button>
          ))}
        </div>

        <div
          ref={bodyRef}
          contentEditable
          suppressContentEditableWarning
          data-placeholder="Type Your Reply..."
          className="min-h-[220px] py-3 text-sm text-text outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-text-dim"
        />

        {uploadedFile && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs text-text-muted">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-4 w-4 text-text-dim">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M14 2v6h6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {uploadedFile.name} · {recipients.length} recipient{recipients.length === 1 ? "" : "s"}
          </div>
        )}

        {error && (
          <div className="mt-4 text-xs text-coral-soft-text bg-coral-soft-bg rounded-md px-3 py-2 inline-block">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border-soft">
      <span className="w-14 shrink-0 text-sm text-text-muted">{label}</span>
      {children}
    </div>
  );
}
