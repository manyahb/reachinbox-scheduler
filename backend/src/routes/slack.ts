import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

const SLACK_AUTHORIZE_URL = "https://slack.com/oauth/v2/authorize";
const SLACK_TOKEN_URL = "https://slack.com/api/oauth.v2.access";

// Step 1: "Connect Slack" button hits this — redirects to Slack's real OAuth consent screen.
router.get("/oauth/start", (req, res) => {
  const uid = req.cookies?.uid;
  if (!uid) return res.status(401).send("Log in first");

  const params = new URLSearchParams({
    client_id: process.env.SLACK_CLIENT_ID || "",
    scope: "incoming-webhook",
    redirect_uri: process.env.SLACK_REDIRECT_URI || "",
    state: String(uid), // carries which user is connecting through the redirect
  });
  res.redirect(`${SLACK_AUTHORIZE_URL}?${params.toString()}`);
});

// Step 2: Slack redirects back with ?code=&state=<userId>. Exchange for a token +
// incoming webhook URL scoped to the channel the user picked, store per-user.
router.get("/oauth/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  const userId = req.query.state as string | undefined;
  if (!code || !userId) return res.status(400).send("Missing code/state");

  try {
    const tokenRes = await fetch(SLACK_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID || "",
        client_secret: process.env.SLACK_CLIENT_SECRET || "",
        redirect_uri: process.env.SLACK_REDIRECT_URI || "",
      }),
    });
    const data = await tokenRes.json();

    if (!data.ok) {
      console.error("Slack OAuth exchange failed:", data);
      return res.status(500).send("Slack connection failed");
    }

    const webhookUrl = data.incoming_webhook?.url;
    const teamName = data.team?.name;

    await pool.query(
      `INSERT INTO slack_integrations (user_id, team_name, access_token, incoming_webhook_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id) DO UPDATE
         SET team_name = EXCLUDED.team_name,
             access_token = EXCLUDED.access_token,
             incoming_webhook_url = EXCLUDED.incoming_webhook_url,
             connected_at = now()`,
      [userId, teamName, data.access_token, webhookUrl]
    );

    res.redirect(`${process.env.FRONTEND_URL}/dashboard?slack=connected`);
  } catch (err) {
    console.error("Slack OAuth error:", err);
    res.status(500).send("Slack connection failed");
  }
});

router.get("/status", async (req, res) => {
  const uid = req.cookies?.uid;
  if (!uid) return res.status(401).json({ error: "Not logged in" });

  const { rows } = await pool.query(
    `SELECT team_name, connected_at FROM slack_integrations WHERE user_id = $1`,
    [uid]
  );
  res.json({ connected: !!rows[0], ...rows[0] });
});

router.delete("/disconnect", async (req, res) => {
  const uid = req.cookies?.uid;
  if (!uid) return res.status(401).json({ error: "Not logged in" });
  await pool.query(`DELETE FROM slack_integrations WHERE user_id = $1`, [uid]);
  res.json({ ok: true });
});

export default router;
