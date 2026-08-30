import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { emailQueue } from "./queues/emailQueue";
import { recoverPendingEmails } from "./services/recovery";
import { ensureEmailIndex } from "./services/search";

import authRoutes from "./routes/auth";
import slackRoutes from "./routes/slack";
import scheduleRoutes from "./routes/schedule";
import emailsRoutes from "./routes/emails";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 4000;

app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(cookieParser());
app.use(express.json());

// --- Live BullMQ dashboard, required by the spec, at /admin/queues ---
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  // Cast needed: @bull-board/api's BaseAdapter typing lags behind the
  // installed bullmq version's Job.progress type — functionally compatible.
  queues: [new BullMQAdapter(emailQueue) as any],
  serverAdapter,
});
app.use("/admin/queues", serverAdapter.getRouter());

app.use("/api/auth", authRoutes);
app.use("/api/slack", slackRoutes);
app.use("/api/schedule", scheduleRoutes);
app.use("/api/emails", emailsRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true }));

async function start() {
  await ensureEmailIndex().catch((err) =>
    console.warn("⚠️  Elasticsearch not reachable at startup:", err.message)
  );

  // This is what makes restarts safe: every boot re-verifies that every
  // pending email in the DB is actually backed by a live BullMQ job.
  await recoverPendingEmails();

  app.listen(PORT, () => {
    console.log(`🚀 Server listening on http://localhost:${PORT}`);
    console.log(`📊 Bull Board dashboard: http://localhost:${PORT}/admin/queues`);
  });
}

start();
