# Recurring Chore Manager App

## What This Is
A React + Vite single-page app for managing household chore schedules. Users pick chores, set recurring schedules, and view them on a built-in calendar. Supports exporting to Apple/Google Calendar via .ics file.

## Project Structure
```
src/
  App.jsx                  # Root component — state management, step routing, localStorage
  App.css                  # All styles (single file, no Tailwind)
  components/
    ChoreLibrary.jsx       # Step 1: select preset or custom chores
    ScheduleSetup.jsx      # Step 2: set frequency per chore
    CalendarView.jsx       # Step 3: monthly calendar + export modal
  data/
    presetChores.js        # 7 categories, ~50 preset chores
  utils/
    scheduleUtils.js       # Occurrence calculation logic (getChoreOccurrencesForMonth, buildCalendarMap)
    icsExport.js           # .ics file generation and download
```

## State
- All state lives in `App.jsx` and is persisted to `localStorage`
- Keys: `chore-step`, `chore-selected`, `chore-schedules`
- `selectedChores`: array of chore objects `{ id, name, emoji, custom? }`
- `schedules`: map of `choreId → { frequency, dayOfWeek, dayOfMonth, month, customDays, startDate }`

## Frequency Types
`daily`, `weekly`, `biweekly`, `monthly`, `quarterly`, `yearly`, `custom`

## Design
- Bright, clean UI — primary color `#4F7FFF`, accent green `#22C55E`
- Max width 680px, mobile-friendly
- 3-step flow with sticky progress bar and sticky footer CTAs

## Commands
```
npm run dev     # Start dev server
npm run build   # Production build
npm run preview # Preview production build
```

## Completion Tracking
- `completions` state in `App.jsx`: `{ "YYYY-MM-DD:choreId": true }`
- localStorage key: `chore-completions`
- Handler: `handleToggleComplete(dayKey, choreId)` — toggled via CalendarView
- Today's Chores panel shows progress bar + celebration state when all done
- Calendar dots turn green when completed; full day cell turns green when all done

## Planned / Not Yet Built
- Email reminders (needs Vercel serverless function + email service like Resend)
- Live Google Calendar sync (needs OAuth backend)
- Streak tracking / history
- Multiple household members / assignment

## Feature Improvement Ideas (2026-03-15 review)

### High Impact / Low Effort
1. **Overdue indicator** — Flag chores from past days that were missed. Add a red badge in Today's panel and highlight overdue calendar cells. All logic exists in `scheduleUtils.js` already.
2. **Upcoming preview** — Show a "Next 7 days" mini-list below today's chores so users can mentally prepare. Reuse `buildCalendarMap` across a date range.
3. **Browser push notifications** — Use the Web Notifications API to fire a morning reminder. No backend needed — `Notification.requestPermission()` + a scheduled `setTimeout` on page load for the day's chores.
4. **Snooze/skip** — Let users mark a chore "skipped" (distinct from completed). Store as `chore-skips` in localStorage. Useful for travel, illness, etc.

### Medium Effort
5. **Streak tracking** — Count consecutive scheduled completions per chore. Show a 🔥 streak counter on each chore in the calendar view. Compute from `completions` state — no backend needed.
6. **Monthly completion report** — At end of month, show a summary card: "You completed 73% of your chores this month." Simple stat derived from `completions` vs `calMap`.
7. **Bulk schedule setter** — On the Schedule Setup screen, add a "Apply to all" button to set the same frequency across all chores at once. Saves time when setting up initially.
8. **Color/category labels** — Assign each chore a color or category label visible on calendar dots. Would improve at-a-glance readability when there are 10+ chores.

### Bigger Additions
9. **Household members** — Add a "Assigned to" field per chore. Show initials on calendar dots. Persist assignments in `chore-schedules`. No backend needed.
10. **Completion history chart** — A simple bar chart (one bar per week, height = % completed) so users can see trends over time. Could use localStorage data already being collected.

### Monetization Note
This app has real commercial potential. The core flow (pick → schedule → track) is polished and solves a real problem. A "Family Plan" with:
- Multiple household member assignments
- Push notification reminders
- Shared completion view (via a simple sync code / URL hash trick)

...could work as a $3–5/month subscription. No complex backend required — a lightweight sync via a shared key in a service like Supabase or even a simple JSON store would suffice.
