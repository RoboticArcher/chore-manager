import { getChoreOccurrencesForMonth } from "./scheduleUtils";

function dateStamp(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
}

function icsDate(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

export function downloadICS(chores, schedules) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Chore Manager//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
  ];

  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const endDate = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  for (const chore of chores) {
    const schedule = schedules[chore.id];
    if (!schedule) continue;

    for (let m = 0; m < 13; m++) {
      const refDate = new Date(now.getFullYear(), now.getMonth() + m, 1);
      const yr = refDate.getFullYear();
      const mo = refDate.getMonth();
      const dates = getChoreOccurrencesForMonth(schedule, yr, mo);

      for (const date of dates) {
        if (date < now || date > endDate) continue;
        const uid = `${chore.id}-${dateStamp(date)}@choremanager`;
        lines.push("BEGIN:VEVENT");
        lines.push(`UID:${uid}`);
        lines.push(`DTSTAMP:${icsDate(new Date())}`);
        lines.push(`DTSTART;VALUE=DATE:${dateStamp(date)}`);
        lines.push(`DTEND;VALUE=DATE:${dateStamp(addDays(date, 1))}`);
        lines.push(`SUMMARY:${chore.emoji} ${chore.name}`);
        lines.push("END:VEVENT");
      }
    }
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
