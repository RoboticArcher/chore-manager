/**
 * Email template for daily chore reminders.
 * Pure functions — no imports, no browser APIs. Safe to use in Node.js API routes.
 */

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Format "YYYY-MM-DD" → "Monday, March 16"
 */
function formatDate(todayStr) {
  const [year, month, day] = todayStr.split("-").map(Number);
  // Use noon UTC to avoid any timezone edge cases in Date construction
  const d = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return `${DAY_NAMES[d.getUTCDay()]}, ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

export function buildSubject(chores) {
  return `🧹 ${chores.length} chore${chores.length !== 1 ? "s" : ""} today — Chore Manager`;
}

export function buildEmailHtml({ chores, todayStr, unsubscribeUrl }) {
  const dateLabel = formatDate(todayStr);

  const choreRows = chores
    .map(
      (c) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f0f0f0;font-size:16px;color:#1a1a1a">
            <span style="margin-right:10px;font-size:20px">${c.emoji || "📋"}</span>${c.name}
          </td>
        </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Chore Reminders</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

          <!-- Header -->
          <tr>
            <td style="background:#4F7FFF;padding:28px 32px">
              <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.75);text-transform:uppercase;letter-spacing:1px;font-weight:600">Chore Manager</p>
              <h1 style="margin:6px 0 0;font-size:22px;color:#ffffff;font-weight:700">${dateLabel}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 32px">
              <p style="margin:0 0 20px;font-size:15px;color:#555">
                Good morning! You have <strong style="color:#1a1a1a">${chores.length} chore${chores.length !== 1 ? "s" : ""}</strong> scheduled today:
              </p>

              <table width="100%" cellpadding="0" cellspacing="0">
                ${choreRows}
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #f0f0f0;background:#fafafa">
              <p style="margin:0;font-size:12px;color:#aaa;text-align:center">
                You're receiving this because you enabled reminders in Chore Manager.<br>
                <a href="${unsubscribeUrl}" style="color:#aaa;text-decoration:underline">Unsubscribe</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
