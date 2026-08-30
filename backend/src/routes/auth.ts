import { Router } from "express";
import { pool } from "../db/pool";

const router = Router();

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";

// Step 1: redirect the browser to Google's consent screen.
router.get("/google", (req, res) => {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
    response_type: "code",
    scope: "openid email profile",
    access_type: "online",
    prompt: "select_account",
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
});

// Step 2: Google redirects back here with a ?code=. Exchange it for tokens,
// fetch the profile, upsert the user, then hand the browser back to the
// frontend dashboard with a simple session cookie (kept intentionally simple
// for this assignment — a real product would use signed/httpOnly JWT sessions).
router.get("/google/callback", async (req, res) => {
  const code = req.query.code as string | undefined;
  if (!code) {
    return res.status(400).send("Missing authorization code");
  }

  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID || "",
        client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
        redirect_uri: process.env.GOOGLE_CALLBACK_URL || "",
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenRes.json();

    const profileRes = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const profile = await profileRes.json();

    const { rows } = await pool.query(
      `INSERT INTO users (google_id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id) DO UPDATE
         SET email = EXCLUDED.email, name = EXCLUDED.name, avatar_url = EXCLUDED.avatar_url
       RETURNING id`,
      [profile.id, profile.email, profile.name, profile.picture]
    );
    const userId = rows[0].id;

    // Minimal session: cookie holding the user id. Swap for JWT/express-session
    // + a secrets manager before this ever sees production traffic.
    res.cookie("uid", userId, { httpOnly: true, sameSite: "lax" });
    res.redirect(`${process.env.FRONTEND_URL}/dashboard`);
  } catch (err) {
    console.error("Google OAuth error:", err);
    res.status(500).send("Google login failed");
  }
});

router.get("/me", async (req, res) => {
  const uid = req.cookies?.uid;
  if (!uid) return res.status(401).json({ error: "Not logged in" });

  const { rows } = await pool.query(
    `SELECT id, email, name, avatar_url FROM users WHERE id = $1`,
    [uid]
  );
  if (!rows[0]) return res.status(401).json({ error: "Not logged in" });
  res.json(rows[0]);
});

router.post("/logout", (req, res) => {
  res.clearCookie("uid");
  res.json({ ok: true });
});

export default router;
