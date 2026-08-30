import { redisConnection } from "../redis";

/**
 * Rate limiting is enforced with a Redis counter keyed by (sender, hour window),
 * incremented atomically via a Lua script so it's safe when many worker
 * processes/instances pull from the same queue concurrently — no in-memory
 * counters anywhere.
 *
 * Key shape: ratelimit:<sender>:<YYYY-MM-DDTHH>
 * The key is given a 1-hour TTL on first write so old windows clean themselves up.
 */

// Returns -1 (sentinel) when the sender is already at/over the cap, without
// incrementing. Otherwise increments and returns the new count. -1 is
// unambiguous because a real counter is always >= 1.
const INCR_IF_UNDER_LIMIT = `
local current = redis.call("GET", KEYS[1])
if current and tonumber(current) >= tonumber(ARGV[1]) then
  return -1
end
local new = redis.call("INCR", KEYS[1])
if tonumber(new) == 1 then
  redis.call("EXPIRE", KEYS[1], 3600)
end
return new
`;

function hourWindowKey(sender: string, date: Date): string {
  const iso = date.toISOString(); // e.g. 2026-08-28T14:32:10.123Z
  const hourBucket = iso.slice(0, 13); // "2026-08-28T14"
  return `ratelimit:${sender}:${hourBucket}`;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Milliseconds until the next hour window opens, useful for rescheduling. */
  msUntilNextWindow: number;
}

/**
 * Attempts to consume one "slot" for this sender in the current hour window.
 * Returns allowed=false (without consuming a slot) if the sender is already
 * at their hourly cap.
 */
export async function tryConsumeRateLimitSlot(
  sender: string,
  hourlyLimit: number
): Promise<RateLimitResult> {
  const now = new Date();
  const key = hourWindowKey(sender, now);

  const result = (await redisConnection.eval(
    INCR_IF_UNDER_LIMIT,
    1,
    key,
    hourlyLimit
  )) as number;

  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  const msUntilNextWindow = nextHour.getTime() - now.getTime();

  return {
    allowed: result !== -1,
    msUntilNextWindow,
  };
}
