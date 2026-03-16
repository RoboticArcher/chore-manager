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

## Planned / Not Yet Built
- Email reminders (needs Vercel serverless function + email service like Resend)
- Live Google Calendar sync (needs OAuth backend)
- Chore completion tracking / streaks
- Multiple household members / assignment
