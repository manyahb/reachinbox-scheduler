import { Worker, Job } from "bullmq";
import dotenv from "dotenv";
import { redisConnection } from "../redis";
import { pool } from "../db/pool";
import { EMAIL_QUEUE_NAME, emailQueue, jobIdForEmail } from "../queues/emailQueue";
import { tryConsumeRateLimitSlot } from "../services/rateLimiter";
import { sendEmailViaEthereal } from "../services/mailer";
import { notifySlackRateLimitHit } from "../services/slack";
import { indexEmail } from "../services/search";

dotenv.config();

const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 5;
const MIN_DELAY_MS = Number(process.env.MIN_DELAY_BETWEEN_EMAILS_MS) || 2000;

interface EmailJobData {
  emailId: number;
}

/**
 * One BullMQ job = one email row. The row id backs the job id (see
 * jobIdForEmail), so if scheduling logic ever runs twice for the same row,
 * BullMQ simply refuses the duplicate add — that's our idempotency guarantee,
 * on top of the DB-level status check below as a second line of defense.
 */
async function processEmailJob(job: Job<EmailJobData>) {
  const { emailId } = job.data;

  const { rows } = await pool.query(`SELECT * FROM emails WHERE id = $1`, [emailId]);
  const email = rows[0];
  if (!email) {
    console.warn(`Email row ${emailId} no longer exists — skipping job ${job.id}`);
    return;
  }

  // Second idempotency guard: if this row was already sent (e.g. a duplicate
  // job somehow got queued before a restart flushed state), don't resend.
  if (email.status === "sent") {
    console.log(`Email ${emailId} already sent — skipping duplicate job ${job.id}`);
    return;
  }

  // --- Rate limiting: Redis-backed counter, safe across many worker instances ---
  const { allowed, msUntilNextWindow } = await tryConsumeRateLimitSlot(
    email.sender_email,
    email.hourly_limit
  );

  if (!allowed) {
    console.log(
      `Sender ${email.sender_email} hit its hourly limit (${email.hourly_limit}). ` +
        `Rescheduling email ${emailId} into next window (+${msUntilNextWindow}ms).`
    );

    await pool.query(
      `UPDATE emails SET status = 'rescheduled', updated_at = now() WHERE id = $1`,
      [emailId]
    );

    await notifySlackRateLimitHit({
      userId: email.user_id,
      sender: email.sender_email,
      hourlyLimit: email.hourly_limit,
    });

    // Re-enqueue into the next hour window under the SAME jobId. BullMQ
    // dedupes on jobId, so this replaces rather than duplicates the pending job.
    await emailQueue.add(
      "send-email",
      { emailId },
      { jobId: jobIdForEmail(emailId), delay: msUntilNextWindow + 1000 }
    );

    // Throw to make BullMQ record this attempt as "moved on", not "sent" —
    // we've already handled it above, so mark complete instead of failed.
    return;
  }

  // --- Minimum delay between sends, per worker slot (mimics provider throttling) ---
  await new Promise((resolve) => setTimeout(resolve, MIN_DELAY_MS));

  await pool.query(`UPDATE emails SET status = 'processing', updated_at = now() WHERE id = $1`, [
    emailId,
  ]);

  try {
    await sendEmailViaEthereal({
      from: email.sender_email,
      to: email.recipient_email,
      subject: email.subject,
      text: email.body,
    });

    await pool.query(
      `UPDATE emails
         SET status = 'sent', sent_at = now(), updated_at = now(), attempts = attempts + 1
       WHERE id = $1`,
      [emailId]
    );

    await indexEmail({
      id: email.id,
      senderEmail: email.sender_email,
      recipientEmail: email.recipient_email,
      subject: email.subject,
      body: email.body,
      status: "sent",
      scheduledTime: email.scheduled_time,
      sentAt: new Date().toISOString(),
    });
  } catch (err: any) {
    await pool.query(
      `UPDATE emails
         SET status = 'failed', last_error = $2, updated_at = now(), attempts = attempts + 1
       WHERE id = $1`,
      [emailId, String(err?.message || err)]
    );
    throw err; // let BullMQ's retry/backoff policy take over
  }
}

export const emailWorker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
  connection: redisConnection,
  concurrency: CONCURRENCY,
});

emailWorker.on("completed", (job) => {
  console.log(`✅ Job ${job.id} completed (email ${job.data.emailId})`);
});

emailWorker.on("failed", (job, err) => {
  console.error(`❌ Job ${job?.id} failed (email ${job?.data.emailId}):`, err.message);
});

console.log(
  `📬 Email worker started — concurrency=${CONCURRENCY}, minDelay=${MIN_DELAY_MS}ms`
);
