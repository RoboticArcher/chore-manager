import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

// In-memory rate limit store for subscribe: { ip -> [timestamps] }
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_SUBSCRIBE_PER_MIN = 5;

function isRateLimited(ip) {
  const now = Date.now();
  const timestamps = (rateLimitMap.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (timestamps.length >= MAX_SUBSCRIBE_PER_MIN) {
    rateLimitMap.set(ip, timestamps);
    return true;
  }
  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  return false;
}

export default async function handler(req, res) {
  // ── DELETE: in-app "Remove Reminders" button ────────────────────
  if (req.method === "DELETE") {
    const { email } = req.query || {};
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Valid email is required" });
    }
    try {
      await redis.del(`subscriber:${email}`);
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error("Redis delete error:", err.message);
      return res.status(500).json({ error: "Storage error" });
    }
  }

  // ── POST: subscribe or update ────────────────────────────────────
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0].trim() ||
    req.headers["x-real-ip"] ||
    "unknown";

  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "Too many requests. Please wait a minute and try again." });
  }

  const { email, timezone, reminderHour, chores, schedules } = req.body || {};

  // Validate email
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }

  // Validate chores array
  if (!Array.isArray(chores)) {
    return res.status(400).json({ error: "Chores must be an array" });
  }
  if (chores.length > 100) {
    return res.status(400).json({ error: "Chores array exceeds maximum length of 100" });
  }
  for (const chore of chores) {
    if (typeof chore.id === "undefined") {
      return res.status(400).json({ error: "Each chore must have an id" });
    }
    if (typeof chore.name !== "string" || chore.name.length === 0 || chore.name.length > 100) {
      return res.status(400).json({ error: "Each chore must have a name (string, max 100 chars)" });
    }
    if (typeof chore.emoji !== "string" || chore.emoji.length === 0 || chore.emoji.length > 8) {
      return res.status(400).json({ error: "Each chore must have an emoji (string, max 8 chars)" });
    }
  }

  try {
    await redis.set(`subscriber:${email}`, {
      email,
      timezone: timezone || "America/New_York",
      reminderHour: typeof reminderHour === "number" ? reminderHour : 8,
      chores,
      schedules: schedules || {},
      updatedAt: Date.now(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Redis write error:", err.message);
    return res.status(500).json({ error: "Storage not configured. Check Upstash Redis env vars." });
  }
}
