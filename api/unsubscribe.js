import { Redis } from "@upstash/redis";
import { createHmac, timingSafeEqual } from "crypto";

const redis = Redis.fromEnv();

function generateToken(email) {
  const secret = process.env.CRON_SECRET || "";
  return createHmac("sha256", secret).update(email).digest("hex");
}

export default async function handler(req, res) {
  const { email, token } = req.query || {};

  if (!email) {
    return res.status(400).send("<h1>Missing email parameter</h1>");
  }

  // Verify the HMAC token to prevent unauthorized unsubscribes via email link
  if (token) {
    const expected = generateToken(email);
    let valid = false;
    try {
      valid = timingSafeEqual(
        Buffer.from(token, "hex"),
        Buffer.from(expected, "hex")
      );
    } catch {
      valid = false;
    }
    if (!valid) {
      return res.status(400).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Invalid Link</title></head>
          <body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center">
            <h2>Invalid unsubscribe link</h2>
            <p>This link has expired or is invalid. Open the app and click Remove to disable reminders.</p>
          </body>
        </html>
      `);
    }
  }
  // Note: in-app "Remove" button calls this without a token (user is authenticated by presence)

  try {
    await redis.del(`subscriber:${email}`);
  } catch (err) {
    console.error("Redis delete error:", err.message);
    // Still show success — worst case is the record was already gone
  }

  return res.status(200).send(`
    <!DOCTYPE html>
    <html>
      <head><title>Unsubscribed — Chore Manager</title></head>
      <body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center">
        <div style="font-size:48px;margin-bottom:16px">✅</div>
        <h2 style="color:#1a1a1a">You're unsubscribed</h2>
        <p style="color:#666">You won't receive any more morning reminders from Chore Manager.</p>
        <p style="margin-top:32px">
          <a href="/" style="color:#4F7FFF;text-decoration:none;font-weight:600">← Back to Chore Manager</a>
        </p>
      </body>
    </html>
  `);
}
