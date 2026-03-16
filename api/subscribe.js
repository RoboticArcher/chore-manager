import { Redis } from "@upstash/redis";

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email, timezone, chores, schedules } = req.body || {};

  // Basic validation
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Valid email is required" });
  }
  if (!Array.isArray(chores)) {
    return res.status(400).json({ error: "Chores must be an array" });
  }

  try {
    await redis.set(`subscriber:${email}`, {
      email,
      timezone: timezone || "America/New_York",
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
