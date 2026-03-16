/**
 * Given a chore's schedule config and a target month/year,
 * returns an array of Date objects when that chore occurs.
 */
export function getChoreOccurrencesForMonth(schedule, year, month) {
  if (!schedule) return [];
  const { frequency, dayOfWeek, dayOfMonth, customDays, startDate } = schedule;
  const start = startDate ? new Date(startDate + "T00:00:00") : new Date(2020, 0, 1);
  const occurrences = [];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  if (frequency === "daily") {
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      if (d >= start) occurrences.push(new Date(d));
    }
  }

  if (frequency === "weekly") {
    const target = dayOfWeek ?? 1;
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      if (d.getDay() === target && d >= start) occurrences.push(new Date(d));
    }
  }

  if (frequency === "biweekly") {
    const target = dayOfWeek ?? 1;
    // Find first occurrence on or after start that matches day of week
    let cursor = new Date(start);
    while (cursor.getDay() !== target) cursor.setDate(cursor.getDate() + 1);
    // Advance cursor to within our month range
    while (cursor < firstDay) cursor.setDate(cursor.getDate() + 14);
    while (cursor <= lastDay) {
      if (cursor >= start) occurrences.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 14);
    }
  }

  if (frequency === "monthly") {
    const dom = dayOfMonth ?? 1;
    const d = new Date(year, month, dom);
    if (d >= start && d <= lastDay) occurrences.push(d);
  }

  if (frequency === "quarterly") {
    const dom = dayOfMonth ?? 1;
    // Check if this month is a quarter month relative to start
    const monthDiff = (year - start.getFullYear()) * 12 + (month - start.getMonth());
    if (monthDiff >= 0 && monthDiff % 3 === 0) {
      const d = new Date(year, month, dom);
      if (d >= start && d <= lastDay) occurrences.push(d);
    }
  }

  if (frequency === "yearly") {
    const targetMonth = schedule.month ?? 0;
    const dom = dayOfMonth ?? 1;
    if (month === targetMonth) {
      const d = new Date(year, month, dom);
      if (d >= start && d <= lastDay) occurrences.push(d);
    }
  }

  if (frequency === "custom") {
    const interval = customDays ?? 7;
    let cursor = new Date(start);
    while (cursor < firstDay) cursor.setDate(cursor.getDate() + interval);
    while (cursor <= lastDay) {
      if (cursor >= start) occurrences.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + interval);
    }
  }

  return occurrences;
}

/**
 * Build a map of { "YYYY-MM-DD": [chore, chore, ...] } for a given month.
 */
export function buildCalendarMap(chores, schedules, year, month) {
  const map = {};
  for (const chore of chores) {
    const schedule = schedules[chore.id];
    if (!schedule) continue;
    const dates = getChoreOccurrencesForMonth(schedule, year, month);
    for (const date of dates) {
      const key = dateKey(date);
      if (!map[key]) map[key] = [];
      map[key].push(chore);
    }
  }
  return map;
}

export function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}
