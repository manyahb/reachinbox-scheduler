import { Router } from "express";
import { pool } from "../db/pool";
import { searchEmails } from "../services/search";

const router = Router();

router.get("/scheduled", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, sender_email, recipient_email, subject, body, scheduled_time, status
       FROM emails
      WHERE status IN ('scheduled', 'processing', 'rescheduled')
      ORDER BY scheduled_time ASC
      LIMIT 200`
  );
  res.json(rows);
});

router.get("/sent", async (req, res) => {
  const { rows } = await pool.query(
    `SELECT id, sender_email, recipient_email, subject, body, sent_at, status
       FROM emails
      WHERE status IN ('sent', 'failed')
      ORDER BY sent_at DESC NULLS LAST
      LIMIT 200`
  );
  res.json(rows);
});

router.get("/search", async (req, res) => {
  const q = String(req.query.q || "");
  if (!q) return res.status(400).json({ error: "Missing ?q=" });

  try {
    const hits = await searchEmails(q);
    res.json(hits);
  } catch (err) {
    console.error("Search error:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
