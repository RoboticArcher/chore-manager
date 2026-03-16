/**
 * ICS export — generates one recurring VEVENT per chore using RRULE.
 * This lets calendar apps (Apple Calendar, Google Calendar) treat each
 * chore as a proper series: delete all, edit series, skip one occurrence, etc.
 */

const DAY_MAP = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function dateStamp(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function icsNow() {
  return new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Convert a schedule object to an RRULE string.
 * Returns null for unsupported/unknown frequencies (falls back to flat events).
 */
function buildRRULE(schedule) {
  const { frequency, dayOfWeek, dayOfMonth, month, customDays } = schedule;

  switch (frequency) {
    case "daily":
      return "RRULE:FREQ=DAILY";

    case "weekly": {
      // Feature #2: dayOfWeek can be an array (multi-day)
      const targets = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek ?? 1];
      const byDay = targets.map((d) => DAY_MAP[d]).join(",");
      return `RRULE:FREQ=WEEKLY;BYDAY=${byDay}`;
    }

    case "biweekly": {
      const dow = Array.isArray(dayOfWeek) ? (dayOfWeek[0] ?? 1) : (dayOfWeek ?? 1);
      return `RRULE:FREQ=WEEKLY;INTERVAL=2;BYDAY=${DAY_MAP[dow]}`;
    }

    case "monthly":
      return `RRULE:FREQ=MONTHLY;BYMONTHDAY=${dayOfMonth ?? 1}`;

    case "quarterly":
      // Quarterly = every 3 months on the same day
      return `RRULE:FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=${dayOfMonth ?? 1}`;

    case "yearly": {
      const mo = (month ?? 0) + 1; // BYMONTH is 1-indexed
      return `RRULE:FREQ=YEARLY;BYMONTH=${mo};BYMONTHDAY=${dayOfMonth ?? 1}`;
    }

    case "custom":
      return `RRULE:FREQ=DAILY;INTERVAL=${customDays ?? 7}`;

    default:
      return null;
  }
}

/**
 * Find the actual first occurrence date for a schedule.
 * DTSTART must match the RRULE pattern, otherwise calendar apps create a
 * phantom extra event on DTSTART that doesn't fit the series.
 */
function getFirstOccurrence(schedule) {
  const { frequency, dayOfWeek, dayOfMonth, month, customDays, startDate } = schedule;
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date();

  switch (frequency) {
    case "daily":
    case "custom":
      // Starts exactly on startDate
      return new Date(start);

    case "weekly": {
      const targets = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek ?? 1];
      // Walk forward from startDate to find the closest matching day
      const d = new Date(start);
      for (let i = 0; i < 8; i++) {
        if (targets.includes(d.getDay())) return d;
        d.setDate(d.getDate() + 1);
      }
      return new Date(start);
    }

    case "biweekly": {
      const target = Array.isArray(dayOfWeek) ? (dayOfWeek[0] ?? 1) : (dayOfWeek ?? 1);
      const d = new Date(start);
      while (d.getDay() !== target) d.setDate(d.getDate() + 1);
      return d;
    }

    case "monthly": {
      const dom = dayOfMonth ?? 1;
      // Use this month if the day hasn't passed startDate, otherwise next month
      let d = new Date(start.getFullYear(), start.getMonth(), dom);
      if (d < start) d = new Date(start.getFullYear(), start.getMonth() + 1, dom);
      return d;
    }

    case "quarterly": {
      const dom = dayOfMonth ?? 1;
      // Advance month by month until we find a date >= startDate
      for (let i = 0; i <= 3; i++) {
        const d = new Date(start.getFullYear(), start.getMonth() + i, dom);
        if (d >= start) return d;
      }
      return new Date(start);
    }

    case "yearly": {
      const targetMonth = schedule.month ?? 0;
      const dom = dayOfMonth ?? 1;
      let d = new Date(start.getFullYear(), targetMonth, dom);
      if (d < start) d = new Date(start.getFullYear() + 1, targetMonth, dom);
      return d;
    }

    default:
      return new Date(start);
  }
}

export function downloadICS(chores, schedules) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chore Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Chore Manager",
  ];

  const stamp = icsNow();

  for (const chore of chores) {
    const schedule = schedules[chore.id];
    if (!schedule) continue;

    const rrule = buildRRULE(schedule);
    if (!rrule) continue;

    const firstOccurrence = getFirstOccurrence(schedule);
    const dtStart = dateStamp(firstOccurrence);
    const dtEnd = dateStamp(new Date(firstOccurrence.getTime() + 86400000)); // +1 day (all-day event)

    // Sanitise summary — fold long lines per RFC 5545 (keep it simple, just escape commas/semicolons)
    const summary = `${chore.emoji} ${chore.name}`.replace(/,/g, "\\,").replace(/;/g, "\\;");

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${chore.id}@choremanager`);
    lines.push(`DTSTAMP:${stamp}`);
    lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
    lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    lines.push(rrule);
    lines.push(`SUMMARY:${summary}`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");

  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chores.ics";
  a.click();
  URL.revokeObjectURL(url);
}
