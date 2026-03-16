/**
 * Given a chore's schedule config and a target month/year,
 * returns an array of Date objects when that chore occurs.
 *
 * Feature #2: dayOfWeek for "weekly" is now an array (e.g. [1, 4] = Mon + Thu).
 * Backward compat: if dayOfWeek is a plain number it's treated as [number].
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
    // Support both array (new) and single number (old data)
    const targets = Array.isArray(dayOfWeek) ? dayOfWeek : [dayOfWeek ?? 1];
    for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
      if (targets.includes(d.getDay()) && d >= start) {
        occurrences.push(new Date(d));
      }
    }
  }

  if (frequency === "biweekly") {
    // Biweekly stays single-day; normalise in case array was accidentally stored
    const target = Array.isArray(dayOfWeek) ? (dayOfWeek[0] ?? 1) : (dayOfWeek ?? 1);
    let cursor = new Date(start);
    while (cursor.getDay() !== target) cursor.setDate(cursor.getDate() + 1);
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

/**
 * Feature #1: Calculate how many consecutive past occurrences of a chore
 * have been completed (counting backwards from today).
 * Returns 0 if no completions, or if the most recent occurrence is not complete.
 */
export function calculateStreak(chore, schedule, completions) {
  if (!schedule || !completions) return 0;

  const today = new Date();
  const todayStr = dateKey(today);

  // Gather occurrences for the past 13 months
  let allOccurrences = [];
  for (let m = 0; m <= 13; m++) {
    const d = new Date(today.getFullYear(), today.getMonth() - m, 1);
    const occs = getChoreOccurrencesForMonth(schedule, d.getFullYear(), d.getMonth());
    allOccurrences = [...allOccurrences, ...occs];
  }

  // Only past / today, sorted most-recent first
  const past = allOccurrences
    .filter((d) => dateKey(d) <= todayStr)
    .sort((a, b) => b - a);

  let streak = 0;
  for (const occ of past) {
    const key = dateKey(occ);
    if (completions[`${key}:${chore.id}`]) {
      streak++;
    } else {
      break; // First incomplete occurrence ends the streak
    }
  }

  return streak;
}
