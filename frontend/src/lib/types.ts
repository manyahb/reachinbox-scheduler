export type EmailStatus =
  | "scheduled"
  | "processing"
  | "sent"
  | "failed"
  | "rescheduled";

export interface ScheduledEmailRow {
  id: number;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  scheduled_time: string;
  status: EmailStatus;
}

export interface SentEmailRow {
  id: number;
  sender_email: string;
  recipient_email: string;
  subject: string;
  body: string;
  sent_at: string | null;
  status: EmailStatus;
}

export interface CurrentUser {
  id: number;
  email: string;
  name: string;
  avatar_url: string;
}

export interface ScheduleResponse {
  batchId: string;
  recipientsDetected: number;
  emailIds: number[];
}

export interface SearchHit {
  id: number;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: EmailStatus;
  scheduledTime: string;
  sentAt?: string | null;
}
