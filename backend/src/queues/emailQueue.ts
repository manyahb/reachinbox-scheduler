import { Queue } from "bullmq";
import { redisConnection } from "../redis";

export const EMAIL_QUEUE_NAME = "email-send-queue";

export const emailQueue = new Queue(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    // Keep a bounded history so Redis doesn't grow unbounded; DB is the real record.
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 1000 },
  },
});

/**
 * Idempotency: BullMQ's jobId is deduplicated by the queue — adding a job with
 * a jobId that already exists (and hasn't finished) is a no-op instead of a
 * duplicate. We derive the jobId directly from the DB row, so re-running the
 * scheduling logic (e.g. after a crash mid-loop) can never double-enqueue the
 * same email.
 */
export function jobIdForEmail(emailId: number): string {
  return `email-${emailId}`;
}
