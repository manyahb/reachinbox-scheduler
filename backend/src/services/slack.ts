import { pool } from "../db/pool";

/**
 * Sends a live Slack message the moment a sender's hourly rate limit is hit.
 * If the user/tenant hasn't connected Slack, this is a silent no-op — never
 * throws, never crashes the worker. If they connect later, notifications
 * start working immediately on the next rate-limit hit (no redeploy needed,
 * since we read the webhook URL from the DB on every call, not from env/cache).
 */
export async function notifySlackRateLimitHit(params: {
  userId: number | null;
  sender: string;
  hourlyLimit: number;
}): Promise<void> {
  const { userId, sender, hourlyLimit } = params;
  if (!userId) return;

  const { rows } = await pool.query(
    `SELECT incoming_webhook_url FROM slack_integrations WHERE user_id = $1`,
    [userId]
  );

  const webhookUrl = rows[0]?.incoming_webhook_url;
  if (!webhookUrl) {
    // Not connected — by design, do nothing.
    return;
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text:
          `:rotating_light: *Rate limit hit* for sender \`${sender}\`\n` +
          `Hourly limit of ${hourlyLimit} reached — remaining emails for this sender ` +
          `have been rescheduled into the next hour window.`,
      }),
    });
  } catch (err) {
    // A Slack outage should never fail the email job itself.
    console.error("Failed to send Slack notification:", err);
  }
}
