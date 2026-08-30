import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  // A stray idle-client error should never crash the whole process
  console.error("Unexpected error on idle Postgres client", err);
});
