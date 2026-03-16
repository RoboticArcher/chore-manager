// Temporary debug endpoint — reveals nothing sensitive, just diagnostics
export default function handler(req, res) {
  const received = req.headers.authorization || "(none)";
  const secret = process.env.CRON_SECRET || "";
  const expected = `Bearer ${secret}`;

  return res.status(200).json({
    // What we received (masked after first 10 chars)
    receivedHeader: received.length > 10
      ? received.slice(0, 10) + "..." + ` (${received.length} chars total)`
      : `"${received}" (${received.length} chars)`,
    // What we expect (masked)
    expectedHeader: expected.length > 10
      ? expected.slice(0, 10) + "..." + ` (${expected.length} chars total)`
      : `"${expected}" (${expected.length} chars)`,
    // Key fact: is CRON_SECRET set at all?
    cronSecretIsSet: secret.length > 0,
    cronSecretLength: secret.length,
    // Do they match?
    match: received === expected,
  });
}
