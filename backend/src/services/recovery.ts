import { pool } from "../db/pool";
import { emailQueue, jobIdForEmail } from "../queues/emailQueue";

/**
 * BullMQ jobs already live in Redis, which itself persists to disk (AOF/RDB),
 * so a plain server restart does NOT lose scheduled jobs by default — this
 * function is the extra safety net for the harder case: Redis was flushed,
 * swapped, or the worker process was down long enough that jobs need
 * re-verifying against the DB (the real source of truth).
 *
 * On boot, for every email still in 'scheduled' or 'processing' state, we
 * check whether a live BullMQ job actually backs it. If not, we re-add it —
 * using the SAME deterministic jobId, so this is safe to run repeatedly
 * without ever creating a duplicate send.
 */
export async function recoverPendingEmails(): Promise<void> {
  const { rows } = await pool.query(
    `SELECT id, scheduled_time FROM emails WHERE status IN ('scheduled', 'processing')`
  );

  let recovered = 0;

  for (const row of rows) {
    const jobId = jobIdForEmail(row.id);
    const existingJob = await emailQueue.getJob(jobId);

    if (existingJob) {
      continue; // already backed by a live job — nothing to do
    }

    const delay = Math.max(0, new Date(row.scheduled_time).getTime() - Date.now());
    await emailQueue.add("send-email", { emailId: row.id }, { jobId, delay });

    // 'processing' rows mean the worker died mid-send last time — treat as
    // scheduled again rather than assuming it went out.
    await pool.query(`UPDATE emails SET status = 'scheduled', updated_at = now() WHERE id = $1`, [
      row.id,
    ]);

    recovered++;
  }

  if (recovered > 0) {
    console.log(`🔁 Recovery: re-attached ${recovered} pending email(s) to the queue.`);
  } else {
    console.log("🔁 Recovery: all pending emails already backed by live jobs.");
  }
}
