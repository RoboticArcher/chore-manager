# Recurring Chore Manager App

## What This Is
A React + Vite single-page app for managing household chore schedules. Users pick chores, set recurring schedules, and view them on a built-in calendar. Supports exporting to Apple/Google Calendar (.ics), completion tracking, streaks, and daily email reminders.

**Live URL:** chore-manager-nine.vercel.app
**Repo:** github.com/RoboticArcher/chore-manager

## Project Structure
```
src/
  App.jsx                  # Root component — state management, step routing, localStorage
  App.css                  # All styles (single file, no Tailwind)
  components/
    ChoreLibrary.jsx       # Step 1: select preset or custom chores
    ScheduleSetup.jsx      # Step 2: set frequency per chore + streak badge
    CalendarView.jsx       # Step 3: monthly calendar + export + reminders
  data/
    presetChores.js        # 7 categories, ~50 preset chores
  utils/
    scheduleUtils.js       # Occurrence calculation (getChoreOccurrencesForMonth, buildCalendarMap, calculateStreak)
    icsExport.js           # .ics RRULE generation and download
    emailTemplate.js       # HTML email builder (pure JS, used by API route)
api/
  subscribe.js             # POST: saves subscriber + schedule to Upstash Redis
  unsubscribe.js           # GET: one-click unsubscribe (HMAC token validation)
  send-daily.js            # Cron handler: runs hourly, sends Resend emails per timezone
vercel.json                # Cron schedule: "0 * * * *" (every hour)
```

## State
All state lives in `App.jsx` and is persisted to `localStorage`.

### localStorage Keys
| Key | Type | Description |
|-----|------|-------------|
| `chore-step` | string | Current step: `"library"` \| `"schedule"` \| `"calendar"` |
| `chore-selected` | array | Selected chore objects: `{ id, name, emoji, custom? }` |
| `chore-custom` | array | Custom chores — separate from selected so deselecting doesn't delete |
| `chore-schedules` | object | `{ choreId: { frequency, dayOfWeek, dayOfMonth, month, customDays, startDate } }` |
| `chore-completions` | object | `{ "YYYY-MM-DD:choreId": true }` |
| `reminder-email` | string\|null | Subscribed email address, null if not subscribed |
| `reminder-hour` | number | Hour to send email (0–23), default 8 |
| `reminder-timezone` | string | IANA timezone string, default device timezone |

### Schedule Shape
```js
{
  frequency: "daily" | "weekly" | "biweekly" | "monthly" | "quarterly" | "yearly" | "custom",
  dayOfWeek: [1, 4],   // Array for weekly (Mon + Thu); biweekly uses dayOfWeek[0]
  dayOfMonth: 15,      // For monthly/quarterly/yearly (1–28)
  month: 2,            // For yearly (0-indexed, 0 = January)
  customDays: 7,       // For custom frequency
  startDate: "2026-03-16"  // ISO string
}
```

### Completion Tracking
- `completions` state: `{ "YYYY-MM-DD:choreId": true }` — only stores completed entries
- Handler: `handleToggleComplete(dayKey, choreId)` — toggled via CalendarView
- Calendar dots turn green when done; full cell turns green when all done
- Monthly completion % shown as a banner above the calendar

## Frequency Types
`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `custom`

- **weekly**: `dayOfWeek` is an array — supports multi-day (Mon + Wed + Fri)
- **biweekly**: single day, uses `dayOfWeek[0]`
- **monthly/quarterly/yearly**: `dayOfMonth` is clamped to last day of month (no overflows)
- **custom**: fires every `customDays` days from `startDate`

## Email Reminders (Added 2026-03-16)

### Infrastructure
- **Resend** — email delivery (free: 3,000/month, 100/day). Sender: `onboarding@resend.dev`
- **Upstash Redis** — subscriber storage. Linked via Vercel integration.
- **Vercel Cron** — hourly trigger at `"0 * * * *"`. Checks each subscriber's timezone, sends only when current hour matches their preferred time.

### Required Env Vars (set in Vercel dashboard)
```
RESEND_API_KEY          # From resend.com
UPSTASH_REDIS_REST_URL  # Auto-set by Vercel when KV linked
UPSTASH_REDIS_REST_TOKEN # Auto-set by Vercel when KV linked
CRON_SECRET             # Any random string — used to secure the cron endpoint
```

### Redis Data Shape
```js
// Key: "subscriber:user@email.com"
{
  email: "user@email.com",
  timezone: "America/New_York",
  reminderHour: 8,          // 0–23
  chores: [...],            // Full chore array (snapshot)
  schedules: { ... },       // Full schedules map (snapshot)
  updatedAt: 1710000000000
}
```

### Auto-sync
When `selectedChores` or `schedules` changes in the app AND `reminderEmail` is set, App.jsx debounces (1.5s) and re-POSTs the full schedule snapshot to `/api/subscribe`. This keeps the server-side data current without any user action.

### Unsubscribe
- In-app: "Turn off reminders" button → calls `/api/unsubscribe?email=...` (no token)
- Email link: `/api/unsubscribe?email=...&token=...` — HMAC-SHA256 token prevents unauthorized removal

## ICS Export
`icsExport.js` generates one VEVENT per chore using RRULE (not individual flat events). Calendar apps treat each chore as a proper recurring series — edit all, delete series, skip occurrence.

RRULE mappings:
- daily → `FREQ=DAILY`
- weekly → `FREQ=WEEKLY;BYDAY=MO,TH`
- biweekly → `FREQ=WEEKLY;INTERVAL=2;BYDAY=MO`
- monthly → `FREQ=MONTHLY;BYMONTHDAY=15`
- quarterly → `FREQ=MONTHLY;INTERVAL=3;BYMONTHDAY=1`
- yearly → `FREQ=YEARLY;BYMONTH=3;BYMONTHDAY=15`
- custom → `FREQ=DAILY;INTERVAL=7`

DTSTART is calculated to align with the RRULE pattern (avoids phantom events in calendar apps).

## Design
- Bright, clean UI — primary color `#4F7FFF`, accent green `#22C55E`
- Max width 680px, mobile-friendly, sticky header + footer on each step
- 3-step flow with clickable progress bar (steps 1 and 2 backtrackable)
- Toast notifications with undo support

## Features Implemented
- ✅ 50+ preset chores across 7 categories
- ✅ Custom chore creation with emoji picker
- ✅ 7 recurrence frequencies with multi-day weekly support
- ✅ Completion tracking per day with progress bar
- ✅ Monthly completion % summary
- ✅ Streak calculation (🔥 consecutive completions)
- ✅ .ics export as recurring RRULE series
- ✅ Email reminders with timezone + time-of-day picker
- ✅ Auto-sync schedule to server on changes
- ✅ Undo for custom chore deletion
- ✅ Clickable stepper navigation
- ✅ "Mark all done" / "Unmark all" button on daily chore card
- ✅ Optional chore notes field (100 chars, shown in calendar view)
- ✅ International timezone support (30+ timezones grouped by region)
- ✅ Dark mode toggle (🌙/☀️, persisted to localStorage)
- ✅ Confetti animation when all chores for a day are completed
- ✅ Stats Dashboard modal — 6-month completion bar chart + all-time count + active streaks
- ✅ Seasonal chore suggestions banner (spring/summer/fall/winter, dismissable, auto-adds as custom)
- ✅ Past date warning when start date is >7 days in the past
- ✅ ARIA labels on calendar nav, day cells, and all action buttons
- ✅ Print schedule button in Export modal (@media print CSS)

## Commands
```
npm run dev     # Start dev server
npm run build   # Production build (run before every commit)
npm run preview # Preview production build
```

## Known Issues / Potential Improvements

### Should Build Next
1. **Overdue indicator** — Flag chores from past days that weren't completed. Red badge in Today's panel, highlighted cells in calendar. All data already available.
2. **Upcoming preview** — "Next 7 days" mini-list below today's chores. Reuse `buildCalendarMap` across date range.
3. **Timezone change after subscribing** — Currently users must remove + re-add reminders to change timezone. Easy to add a timezone picker to the active reminders panel alongside the time picker.
4. **"Unscheduled chores" warning** — If a chore is selected but has no schedule, it silently disappears from the calendar. Show a warning banner.
5. **Streak memoization** — `calculateStreak` loops 13 months per chore on every ScheduleSetup render. With 20+ chores, memoize per-chore keyed by completions.

### Medium Effort
6. **Next N occurrences preview** — Show "next 3 dates" on collapsed schedule cards to verify setup without expanding
7. **Snooze/skip** — Mark a chore "skipped" (distinct from completed). Store in `chore-skips`. Useful for travel/illness.
8. **Bulk schedule setter** — "Apply to all" button on Schedule Setup to set same frequency across all chores at once
9. **Completion history chart** — Bar chart (week by week, height = % completed). All data is in localStorage already.

### Bigger Additions
10. **Household members** — "Assigned to" field per chore. Initials on calendar dots. No backend needed.
11. **Push notifications** — Web Notifications API + service worker. No extra backend — fires on page load for today's chores.

### Monetization Note
The email reminder infrastructure (Resend + Redis + Cron) scales cleanly to multi-user. The app is already usable as a product:
- Free tier: local only (works today)
- Paid tier (~$3–5/month): email reminders + family sharing + sync across devices
A "Family Plan" with shared completion view (via sync code or Supabase) and multi-user assignments would be the natural next commercial step.

## Code Notes
- `buildCalendarMap` is memoized in CalendarView with `useMemo` — only recomputes on chore/schedule/month changes, not completion toggles
- `localStorage` writes use `saveToStorage()` helper which catches `QuotaExceededError`
- Schedule auto-sync is debounced 1.5s to prevent API spam on rapid chore changes
- `dayOfMonth` is clamped to last valid day of the month in `scheduleUtils.js` (prevents overflow to next month)
- `customChores` stored separately from `selectedChores` — deselecting a custom chore doesn't delete it
- Start date `onChange` validates `YYYY-MM-DD` regex before saving — prevents malformed keyboard entry
- Chore notes stored in `chore-schedules` alongside schedule data (key: `notes` on each schedule object)
- `.chore-chip .chore-name` scoped truncation — ellipsis only in chips, not in detail list rows
