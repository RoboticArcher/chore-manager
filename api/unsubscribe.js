import { Redis } from "@upstash/redis";
import { timingSafeEqual } from "crypto";
import { generateToken, getCronSecret } from "../src/utils/tokenUtils.js";

// Validate secret at startup — throws immediately if misconfigured
getCronSecret();

const redis = Redis.fromEnv();

export default async function handler(req, res) {
  const { email, token } = req.query || {};

  if (!email) {
    return res.status(400).send("<h1>Missing email parameter</h1>");
  }

  // Token is always required — a missing token is an auth failure, not a bypass
  if (!token) {
    return res.status(400).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Invalid Link</title></head>
        <body style="font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 20px;text-align:center">
          <h2>Invalid unsubscribe link</h2>
          <p>This link is missing its security token. Open the app and click Remove to disable reminders.</p>
        </body>
      </html>
    `);
  }

  // Verify the HMAC token to prevent unauthorized unsubscribes
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

  try {
    await redis.del(`subscriber:${email}`);
  } catch (err) {
    console.error("Redis delete error:", err.message);
    // Still show success — worst case the record was already gone
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
