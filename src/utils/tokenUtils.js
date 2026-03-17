import { createHmac } from "crypto";

/**
 * Returns the CRON_SECRET env var.
 * Throws at startup if it is missing or too short (< 32 chars) so the
 * misconfiguration is caught immediately rather than silently degrading.
 */
export function getCronSecret() {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "CRON_SECRET env var must be set and at least 32 characters long. " +
      "Generate one with: openssl rand -hex 32"
    );
  }
  return secret;
}

/**
 * Generates an HMAC-SHA256 token for the given email using CRON_SECRET.
 * Used to authenticate unsubscribe links sent in emails.
 */
export function generateToken(email) {
  return createHmac("sha256", getCronSecret()).update(email).digest("hex");
}
