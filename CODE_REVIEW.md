# Recurring-Chore-Manager-App — Code Review
**Reviewed:** 2026-03-16
**Files reviewed:** `src/App.jsx`, `src/components/CalendarView.jsx`, `src/components/ScheduleSetup.jsx`, `src/components/ChoreLibrary.jsx`, `src/utils/scheduleUtils.js`, `src/utils/icsExport.js`, `src/utils/emailTemplate.js`, `api/send-daily.js`, `api/subscribe.js`, `api/unsubscribe.js`, `vercel.json`, `package.json`

---

## Summary
A polished React chore-scheduling app with Vercel Cron + Upstash Redis for daily email reminders. The architecture is clean, the schedule math is well-thought-out, and the ICS export handles edge cases properly. However there are several meaningful security gaps — particularly in the unsubscribe flow and the Redis data storage — that need to be addressed before this is used with real subscriber data.

---

## 🐛 Bugs

### 1. `canvas-confetti` import not verified in `package.json` *(critical — build failure)*
`CalendarView.jsx` imports `canvas-confetti`:
```js
import confetti from "canvas-confetti";
```
But `package.json` does not list `canvas-confetti` as a dependency. This will cause a build failure when deploying to Vercel.

**Fix:** Run `npm install canvas-confetti` and commit the updated `package.json` and `package-lock.json`.

### 2. `handleUpdateTime` timeout not cleared on component unmount *(medium)*
In `CalendarView.jsx`:
```js
setTimeout(() => setUpdateStatus("idle"), 2000);
```
This timeout ID is not stored and therefore cannot be cleared when the component unmounts. If the user navigates away within 2 seconds of saving a reminder time, the timeout fires and attempts to call `setUpdateStatus` on an unmounted component.

**Fix:** Store the timeout in a `useRef` and clear it in a `useEffect` cleanup.

### 3. `send-daily.js` — cron timing is best-effort only *(medium)*
The cron runs every hour (`"0 * * * *"`) and checks each subscriber's `reminderHour` against the current hour in their timezone. Vercel Cron has no guaranteed sub-minute precision; cold starts can delay execution by 30–90 seconds. If a cron fires at 8:59:50 UTC and a subscriber is in a timezone where that resolves to hour 8, they'll get their email. But if the cron fires at 9:00:15 (delayed past the hour boundary), that subscriber is silently skipped until the next day.

**Fix:** Add a ±1 minute grace window, or store a `lastSentDate` per subscriber in Redis to detect and retry missed deliveries.

### 4. `scheduleUtils.js` — date mutation in loop *(low)*
In `getChoreOccurrencesForMonth`, daily and weekly loops mutate a single `Date` object:
```js
for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1))
```
This works correctly because `new Date(d)` is pushed to the array (a copy), but mutating `d` directly is fragile. Any future refactor that accidentally pushes `d` instead of `new Date(d)` would produce an array of references all pointing to the same date.

**Fix:** Use `d = new Date(d.getTime() + 86400000)` (immutable step) or be explicit with a comment warning about the mutation pattern.

### 5. `getScheduleSummary` references `normWeekDays` from `ScheduleSetup.jsx` but it's defined locally there *(low)*
The `getScheduleSummary` function (exported from `ScheduleSetup.jsx`) calls `normWeekDays` on line 267, which is defined inside the same file. This is technically fine but the function is exported and used elsewhere (in `CalendarView.jsx`). If `getScheduleSummary` is ever moved to `scheduleUtils.js`, the dependency on `normWeekDays` could be missed.

**Fix:** Move `normWeekDays` to `scheduleUtils.js` alongside `getChoreOccurrencesForMonth`.

---

## 🔒 Security Issues

### 1. `CRON_SECRET` empty string is a critical vulnerability *(critical)*
`generateToken(email)` in both `send-daily.js` and `unsubscribe.js` uses `CRON_SECRET` as the HMAC key:
```js
const secret = process.env.CRON_SECRET || "";
```
If `CRON_SECRET` is not set (e.g., in a local dev environment or a misconfigured deployment), the HMAC key becomes an empty string `""`. This means:
- Any unsubscribe token becomes **fully predictable** — an attacker knowing only an email address can compute the exact token needed to unsubscribe that user
- The cron auth check (`authHeader !== expectedAuth`) becomes `"Bearer " !== "Bearer "` which is always false → the cron endpoint rejects all requests, including legitimate Vercel cron calls

**Fix:** Add a startup check that throws if `CRON_SECRET` is missing or fewer than 32 characters:
```js
const secret = process.env.CRON_SECRET;
if (!secret || secret.length < 32) throw new Error("CRON_SECRET must be set");
```

### 2. Unauthenticated unsubscribe endpoint *(high)*
In `unsubscribe.js`, the token validation is wrapped in `if (token) {...}`. This means a request with **no token at all** passes straight through to the Redis deletion. Any malicious actor who knows a subscriber's email address can unsubscribe them by hitting:
```
GET /api/unsubscribe?email=victim@example.com
```
The comment says "in-app 'Remove' button calls this without a token (user is authenticated by presence)" — but the API endpoint is publicly accessible on the internet. There is no such thing as "authenticated by presence" for a public HTTP endpoint.

**Fix:** The in-app remove button should also pass the token (derive it client-side from the same HMAC formula), or use a different endpoint/method for in-app removal that verifies the request came from the authenticated session.

### 3. No rate limiting or size limits on `subscribe.js` *(high)*
The subscribe endpoint accepts arbitrary `chores` and `schedules` arrays with no validation of:
- Maximum array length (someone could POST 10,000 chores)
- Maximum field lengths within each chore
- Type safety beyond the basic `Array.isArray(chores)` check

This means an attacker can:
- Flood Redis with large payloads, consuming storage quota
- Craft a `chores` array that causes `buildCalendarMap` to run very slowly when processed by `send-daily.js`

**Fix:**
- Add `chores.length <= 100` guard
- Validate each chore object has `id` (string/number), `name` (string, max 100 chars), `emoji` (string, max 4 chars)
- Add per-IP rate limiting (e.g., 5 subscribe calls per minute)

### 4. `generateToken` is duplicated across two files *(medium)*
`send-daily.js` and `unsubscribe.js` both define an identical `generateToken` function. This is a maintenance risk — if the HMAC algorithm needs to change, both files must be updated atomically or tokens become invalid.

**Fix:** Extract to `src/utils/tokenUtils.js` and import in both files.

### 5. No `Content-Security-Policy` headers *(low)*
Like the my-shelf app, there are no security headers configured in `vercel.json`. Since this app stores sensitive data (subscriber email, timezone) in localStorage, XSS protection is important.

---

## 💡 Improvements

### 1. `send-daily.js` — Errors during batch processing are collected but not alertable
Errors are pushed to an `errors` array and logged via `console.error`, but there's no notification mechanism. If 50% of emails fail, the only way to know is to check Vercel logs.

**Suggestion:** If `errors.length > keys.length * 0.1` (>10% failure rate), consider writing a `send-errors:{date}` key to Redis for monitoring, or integrate with a Slack webhook / email alert.

### 2. Streak calculation scans 13 months of history on every render
`calculateStreak` in `scheduleUtils.js` iterates over 13 months of occurrences on every call. It's called for every chore in `ScheduleSetup`, which could mean 20+ calls each generating hundreds of dates.

**Suggestion:** Memoize the streak per `(chore.id, schedule, lastCompletionDate)` using `useMemo` in the component, or cache results in a WeakMap.

### 3. ICS export doesn't include `DESCRIPTION` or `LOCATION` fields
The generated `.ics` events have `SUMMARY` but no `DESCRIPTION`. If a chore has a schedule note (stored in `schedule.notes`), it would be useful to include it as the event description for calendar apps that display it.

### 4. Monthly/Quarterly date picker limited to day 28
Both monthly and quarterly schedule pickers only offer days 1–28:
```js
Array.from({ length: 28 }, (_, i) => i + 1)
```
Days 29–31 are valid for many months. The `scheduleUtils.js` clamp logic already handles month-end edge cases correctly, so day 29–31 can be safely added.

**Fix:** Increase to 31 days in the picker (the math already handles clamping).

### 5. Reminder time options are limited (6 AM – 12 PM only)
`REMINDER_TIMES` in `CalendarView.jsx` offers only 6 time options from 6 AM to 12 PM. A user who wants a 3 PM or 8 PM reminder has no option.

**Suggestion:** Expand to a full 24-hour range, or allow free hour input.

---

## ✅ What's Done Well
- `timingSafeEqual` is correctly used for HMAC token comparison (prevents timing attacks)
- `buildCalendarMap` is `useMemo`-wrapped in `CalendarView` — excellent performance practice
- `QuotaExceededError` is gracefully handled in `saveToStorage`
- Backwards compatibility for `dayOfWeek` (old single-number format → new array format) is well-handled across all utilities
- UTC-based date construction in `emailTemplate.js` avoids timezone edge cases in date formatting
- The `generateToken` / unsubscribe HMAC flow is the right concept — just needs the gap in enforcement fixed
- ICS export correctly aligns `DTSTART` with the actual first RRULE occurrence (a common ICS bug)
- Undo functionality for custom chore deletion is a thoughtful UX touch
