import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { pool } from "../db/pool";
import { emailQueue, jobIdForEmail } from "../queues/emailQueue";
import { indexEmail } from "../services/search";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const EMAIL_REGEX = /[^\s,;]+@[^\s,;]+\.[^\s,;]+/g;

function extractEmails(fileText: string): string[] {
  const matches = fileText.match(EMAIL_REGEX) || [];
  return Array.from(new Set(matches.map((e) => e.trim().toLowerCase())));
}

/**
 * POST /api/schedule
 * multipart/form-data:
 *   subject, body, senderEmail, startTime (ISO), delayMs, hourlyLimit
 *   leadsFile (CSV or .txt of recipient emails)
 */
router.post("/", upload.single("leadsFile"), async (req, res) => {
  try {
    const uid = req.cookies?.uid || null;
    const { subject, body, senderEmail, startTime, delayMs, hourlyLimit } = req.body;

    if (!subject || !body || !senderEmail || !startTime || !req.file) {
      return res.status(400).json({
        error: "subject, body, senderEmail, startTime, and leadsFile are all required",
      });
    }

    const recipients = extractEmails(req.file.buffer.toString("utf-8"));
    if (recipients.length === 0) {
      return res.status(400).json({ error: "No valid email addresses found in the uploaded file" });
    }

    const batchId = crypto.randomUUID();
    const minDelayMs = Number(delayMs) || 2000;
    const perSenderHourlyLimit = Number(hourlyLimit) || 200;
    const start = new Date(startTime);

    const created: number[] = [];

    // Stagger scheduled_time by minDelayMs per recipient so the "start time +
    // delay between emails" contract is visible even before the rate limiter
    // or worker concurrency gets involved.
    for (let i = 0; i < recipients.length; i++) {
      const scheduledTime = new Date(start.getTime() + i * minDelayMs);

      const { rows } = await pool.query(
        `INSERT INTO emails
           (user_id, sender_email, recipient_email, subject, body, scheduled_time,
            batch_id, min_delay_ms, hourly_limit, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'scheduled')
         RETURNING id`,
        [
          uid,
          senderEmail,
          recipients[i],
          subject,
          body,
          scheduledTime.toISOString(),
          batchId,
          minDelayMs,
          perSenderHourlyLimit,
        ]
      );
      const emailId = rows[0].id;
      created.push(emailId);

      const delay = Math.max(0, scheduledTime.getTime() - Date.now());
      await emailQueue.add(
        "send-email",
        { emailId },
        { jobId: jobIdForEmail(emailId), delay }
      );

      await indexEmail({
        id: emailId,
        senderEmail,
        recipientEmail: recipients[i],
        subject,
        body,
        status: "scheduled",
        scheduledTime: scheduledTime.toISOString(),
      });
    }

    res.status(201).json({
      batchId,
      recipientsDetected: recipients.length,
      emailIds: created,
    });
  } catch (err) {
    console.error("Schedule error:", err);
    res.status(500).json({ error: "Failed to schedule emails" });
  }
});

export default router;
