import IORedis from "ioredis";
import dotenv from "dotenv";

dotenv.config();

// BullMQ requires maxRetriesPerRequest: null on the connection it manages.
export const redisConnection = new IORedis({
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  maxRetriesPerRequest: null,
});
