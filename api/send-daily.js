import { Redis } from "@upstash/redis";
import { buildCalendarMap } from "../src/utils/scheduleUtils.js";
import { buildEmailHtml, buildSubject } from "../src/utils/emailTemplate.js";
import { generateToken, getCronSecret } from "../src/utils/tokenUtils.js";

// Validate secret at startup — throws immediately if misconfigured
getCronSecret();

const redis = Redis.fromEnv();

/**
 * Get today's date string ("YYYY-MM-DD") in a given IANA timezone.
 * Uses "en-CA" locale which natively formats as YYYY-MM-DD.
 */
function getTodayInTz(timezone) {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

/**
 * Get the current hour (0–23) in a given IANA timezone.
 */
function getCurrentHourInTz(timezone) {
  try {
    const hourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const h = parseInt(hourStr, 10);
    // Intl returns "24" for midnight in some environments — normalize to 0
    return h === 24 ? 0 : h;
  } catch {
    return new Date().getUTCHours();
  }
}

async function sendEmail(to, subject, html) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Chore Manager <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
  return res.json();
}

export default async function handler(req, res) {
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET> automatically
  const authHeader = req.headers.authorization || "";
  const expectedAuth = `Bearer ${process.env.CRON_SECRET || ""}`;
  if (authHeader !== expectedAuth) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  let keys;
  try {
    keys = await redis.keys("subscriber:*");
  } catch (err) {
    console.error("Redis keys error:", err.message);
    return res.status(500).json({ error: "Redis not configured" });
  }

  if (!keys || keys.length === 0) {
    return res.status(200).json({ sent: 0, skipped: 0, message: "No subscribers" });
  }

  let sent = 0;
  let skipped = 0;
  const errors = [];

  // Process in batches of 20 to avoid rate limiting
  const batchSize = 20;
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (key) => {
        let subscriber;
        try {
          subscriber = await redis.get(key);
        } catch (err) {
          errors.push(`Redis read failed for ${key}: ${err.message}`);
          return;
        }

        if (!subscriber || !subscriber.email) return;

        try {
          const timezone = subscriber.timezone || "America/New_York";
          const preferredHour = subscriber.reminderHour ?? 8;

          // Only send if the current hour in their timezone matches their preferred time
          const currentHour = getCurrentHourInTz(timezone);
          if (currentHour !== preferredHour) {
            skipped++;
            return;
          }

          const todayStr = getTodayInTz(timezone);
          const [year, month] = todayStr.split("-").map(Number);

          const calMap = buildCalendarMap(
            subscriber.chores || [],
            subscriber.schedules || {},
            year,
            month - 1 // buildCalendarMap uses 0-indexed month
          );

          const todayChores = calMap[todayStr] || [];
          if (todayChores.length === 0) {
            skipped++;
            return;
          }

          const unsubscribeToken = generateToken(subscriber.email);
          const baseUrl = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : "https://chore-manager-nine.vercel.app";
          const unsubscribeUrl = `${baseUrl}/api/unsubscribe?email=${encodeURIComponent(subscriber.email)}&token=${unsubscribeToken}`;

          const subject = buildSubject(todayChores);
          const html = buildEmailHtml({
            chores: todayChores,
            todayStr,
            unsubscribeUrl,
          });

          await sendEmail(subscriber.email, subject, html);
          sent++;
        } catch (err) {
          errors.push(`Failed for ${subscriber.email}: ${err.message}`);
        }
      })
    );
  }

  if (errors.length > 0) {
    console.error("Send errors:", errors);
  }

  return res.status(200).json({ sent, skipped, errors: errors.length });
}
